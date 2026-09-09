import * as Clipboard from 'expo-clipboard';
import { Platform, Share } from 'react-native';

import { shareOrCopy } from '@/lib/share-link';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));

describe('shareOrCopy', () => {
  const nav = globalThis as { navigator?: unknown };
  let originalNavigator: unknown;
  beforeEach(() => {
    originalNavigator = nav.navigator;
  });
  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: originalNavigator,
    });
  });

  it('네이티브는 공유 시트 — 취소는 cancelled', async () => {
    const os = jest.replaceProperty(Platform, 'OS', 'ios');
    const share = jest.spyOn(Share, 'share').mockResolvedValueOnce({ action: 'sharedAction' });
    try {
      await expect(shareOrCopy('hi')).resolves.toBe('shared');
      expect(share).toHaveBeenCalledWith({ message: 'hi' });
      share.mockRejectedValueOnce(new Error('dismissed'));
      await expect(shareOrCopy('hi')).resolves.toBe('cancelled');
    } finally {
      share.mockRestore();
      os.restore();
    }
  });

  it('웹에 navigator.share가 있으면 그걸 쓴다', async () => {
    const os = jest.replaceProperty(Platform, 'OS', 'web');
    const share = jest.fn(async () => {});
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { share } });
    try {
      await expect(shareOrCopy('link')).resolves.toBe('shared');
      expect(share).toHaveBeenCalledWith({ text: 'link' });
      expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
    } finally {
      os.restore();
    }
  });

  it('웹에 navigator.share가 없으면 클립보드 복사로 대신하고 copied를 돌려준다', async () => {
    const os = jest.replaceProperty(Platform, 'OS', 'web');
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
    try {
      await expect(shareOrCopy('link')).resolves.toBe('copied');
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith('link');
    } finally {
      os.restore();
    }
  });
});
