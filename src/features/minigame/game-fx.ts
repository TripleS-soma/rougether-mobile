import * as Haptics from 'expo-haptics';

import { parseGameEnvelope } from '@/features/minigame/message-envelope';
import { hapticImpact, hapticSelection, hapticSuccess } from '@/utils/haptics';

/**
 * 게임 손맛 신호 (#1425) — 게임 문서(WebView)가 `{type:'fx', kind}`로 알리면 앱이 진동한다.
 * 엔진·리플레이·점수와 무관한 표시용 메시지라 서버 검증에 영향이 없다. 진동 세기는
 * 설정의 햅틱 세기(`utils/haptics`)를 그대로 따르고, 끄기면 울리지 않는다.
 */
export type GameFxKind = 'step' | 'jump' | 'merge' | 'milestone' | 'over';

const KINDS: readonly GameFxKind[] = ['step', 'jump', 'merge', 'milestone', 'over'];

/** 이 채널의 fx 메시지면 종류, 아니면 null. 다른 메시지 파싱보다 먼저 부른다. */
export function parseGameFx(raw: unknown, channelId: string): GameFxKind | null {
  const value = parseGameEnvelope(raw, channelId, 2000);
  if (!value || value.type !== 'fx') return null;
  return KINDS.includes(value.kind as GameFxKind) ? (value.kind as GameFxKind) : null;
}

export function playGameFx(kind: GameFxKind): void {
  switch (kind) {
    case 'step':
      hapticSelection();
      return;
    case 'jump':
    case 'merge':
      hapticImpact(Haptics.ImpactFeedbackStyle.Light);
      return;
    case 'milestone':
      hapticSuccess();
      return;
    case 'over':
      hapticImpact(Haptics.ImpactFeedbackStyle.Heavy);
  }
}
