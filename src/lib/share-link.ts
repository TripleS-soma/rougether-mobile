import * as Clipboard from 'expo-clipboard';
import { Platform, Share } from 'react-native';

export type ShareOutcome = 'shared' | 'copied' | 'cancelled';

type WebShare = { share?: (data: { text: string }) => Promise<void> };

/**
 * 공유 시트를 띄우되, 웹에서 `navigator.share`가 없는 브라우저(데스크톱 파이어폭스 등)는
 * 클립보드 복사로 대신한다 — 종전엔 `Share.share`가 조용히 실패해 아무 일도 안 일어났다.
 * 호출부는 'copied'일 때 "복사했어요"를 알려 준다.
 */
export async function shareOrCopy(message: string): Promise<ShareOutcome> {
  if (Platform.OS === 'web') {
    const nav = (globalThis as { navigator?: WebShare }).navigator;
    if (nav?.share) {
      try {
        await nav.share({ text: message });
        return 'shared';
      } catch {
        return 'cancelled';
      }
    }
    await Clipboard.setStringAsync(message);
    return 'copied';
  }
  try {
    await Share.share({ message });
    return 'shared';
  } catch {
    return 'cancelled';
  }
}
