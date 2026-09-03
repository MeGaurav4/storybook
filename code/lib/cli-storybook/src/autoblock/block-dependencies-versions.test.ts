import { beforeEach, expect, test, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';

import { blocker } from './block-dependencies-versions.ts';

vi.mock('storybook/internal/common', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getVitePlusVersions: vi.fn(async () => null),
}));

vi.mock('storybook/internal/node-logger', () => ({
  CLI_COLORS: {
    warning: (value: string) => value,
    info: (value: string) => value,
  },
  logger: {
    info: vi.fn(),
    line: vi.fn(),
    plain: vi.fn(),
  },
  prompt: {
    logBox: vi.fn((value: unknown) => value),
  },
}));

const mockPackageManager = {
  getModulePackageJSON: vi.fn<JsPackageManager['getModulePackageJSON']>(),
} as unknown as JsPackageManager;

const baseOptions = {
  packageManager: mockPackageManager,
  mainConfig: { stories: [] },
  mainConfigPath: '.storybook/main.ts',
  configDir: '.storybook',
};

beforeEach(() => {
  vi.clearAllMocks();
  // Packages outside the scenario under test resolve as not installed.
  mockPackageManager.getModulePackageJSON.mockResolvedValue(null);
});

test('blocks on react 17 with a message linking the migration guide', async () => {
  mockPackageManager.getModulePackageJSON.mockImplementation(async (packageName) => {
    return packageName === 'react' || packageName === 'react-dom' ? { version: '17.0.0' } : null;
  });

  const result = await blocker.check(baseOptions);

  expect(result).toEqual({
    packageName: 'react',
    installedVersion: '17.0.0',
    minimumVersion: '18.0.0',
  });

  if (result === false) {
    throw new Error('Expected the blocker to trigger for react 17');
  }

  const log = blocker.log(result);
  expect(log.title).toBe('React 18 support removed');
  expect(log.message).toContain('Support for React < 18 has been removed');
  expect(log.link).toBe(
    'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#react-require-v18-and-up'
  );
});

test('blocks on react-dom 17 when react itself is current', async () => {
  mockPackageManager.getModulePackageJSON.mockImplementation(async (packageName) => {
    if (packageName === 'react') {
      return { version: '18.2.0' };
    }
    if (packageName === 'react-dom') {
      return { version: '17.0.2' };
    }
    return null;
  });

  const result = await blocker.check(baseOptions);

  expect(result).toEqual({
    packageName: 'react-dom',
    installedVersion: '17.0.2',
    minimumVersion: '18.0.0',
  });
});

test('passes on react 18', async () => {
  mockPackageManager.getModulePackageJSON.mockImplementation(async (packageName) => {
    return packageName === 'react' || packageName === 'react-dom' ? { version: '18.2.0' } : null;
  });

  expect(await blocker.check(baseOptions)).toBe(false);
});

test('passes on react 19', async () => {
  mockPackageManager.getModulePackageJSON.mockImplementation(async (packageName) => {
    return packageName === 'react' || packageName === 'react-dom' ? { version: '19.0.0' } : null;
  });

  expect(await blocker.check(baseOptions)).toBe(false);
});
