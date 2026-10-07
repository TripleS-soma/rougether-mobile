import { Platform } from 'react-native';

import { supportsHomeWidget } from '@/config/features';

describe('supportsHomeWidget', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['ios', true],
    ['android', true],
    ['web', false],
  ] as const)('%s → %s', (os, expected) => {
    jest.replaceProperty(Platform, 'OS', os);
    expect(supportsHomeWidget()).toBe(expected);
  });
});
