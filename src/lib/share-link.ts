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
    const result = await Share.share({ message });
    // iOS는 시트를 그냥 닫으면 예외 대신 dismissedAction을 돌려준다 (#1673) — 예전엔 이것도
    // 'shared'로 봐서, 시트를 열었다 닫기만 해도 초대 미션이 끝나고 공유로 셌다.
    // Android는 취소를 알려주지 않아(항상 sharedAction) 구분할 수 없다 — OS 한계.
    return result.action === Share.dismissedAction ? 'cancelled' : 'shared';
  } catch {
    return 'cancelled';
  }
}
