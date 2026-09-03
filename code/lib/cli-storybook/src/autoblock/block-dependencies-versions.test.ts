import type { JsPackageManager } from 'storybook/internal/common';
import { beforeEach, expect, test, vi } from 'vitest';

import { blocker } from './block-dependencies-versions.ts';
import type { AutoblockOptions } from './types.ts';

vi.mock('storybook/internal/common', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getVitePlusVersions: vi.fn(async () => undefined),
}));

vi.mock('storybook/internal/node-logger', () => ({
  logger: {
    info: vi.fn(),
    line: vi.fn(),
    plain: vi.fn(),
  },
  prompt: {
    logBox: vi.fn((x) => x),
  },
}));

type ModulePackageJSON = Awaited<ReturnType<JsPackageManager['getModulePackageJSON']>>;

const makeOptions = (packages: Record<string, string | undefined>): AutoblockOptions =>
  ({
    packageManager: {
      getModulePackageJSON: async (packageName: string): Promise<ModulePackageJSON> => {
        const version = packages[packageName];
        return version ? { version } : null;
      },
    } as JsPackageManager,
  }) as AutoblockOptions;

beforeEach(() => {
  vi.clearAllMocks();
});

test('@angular/core 20 is blocked with message and migration anchor', async () => {
  const result = await blocker.check(makeOptions({ '@angular/core': '20.0.0' }));

  if (result === false) {
    throw new Error('Expected @angular/core 20.0.0 to be blocked');
  }

  expect(result).toEqual({
    packageName: '@angular/core',
    installedVersion: '20.0.0',
    minimumVersion: '21.0.0',
  });

  const log = blocker.log(result);
  expect(log.title).toBe('Require Angular v21 and up');
  expect(log.message).toContain('Support for Angular < 21 has been removed.');
  expect(log.link).toBe(
    'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#angular-require-v21-and-up'
  );
});

test.each(['21.0.0', '22.1.0'])('@angular/core %s is not blocked', async (version) => {
  const result = await blocker.check(makeOptions({ '@angular/core': version }));
  expect(result).toBe(false);
});

test('missing @angular/core does not block', async () => {
  const result = await blocker.check(makeOptions({}));
  expect(result).toBe(false);
});
