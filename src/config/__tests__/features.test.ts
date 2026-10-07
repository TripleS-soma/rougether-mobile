import { Platform } from 'react-native';

import {
  supportsDeviceCalendar,
  supportsHomeWidget,
  supportsPushNotifications,
  supportsRoomImageSave,
} from '@/config/features';

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

describe('웹에 없는 네이티브 기능', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([supportsDeviceCalendar, supportsRoomImageSave, supportsPushNotifications])(
    '%p — 앱은 켜고 웹은 끈다',
    (supports) => {
      jest.replaceProperty(Platform, 'OS', 'ios');
      expect(supports()).toBe(true);
      jest.replaceProperty(Platform, 'OS', 'android');
      expect(supports()).toBe(true);
      jest.replaceProperty(Platform, 'OS', 'web');
      expect(supports()).toBe(false);
    },
  );
});
