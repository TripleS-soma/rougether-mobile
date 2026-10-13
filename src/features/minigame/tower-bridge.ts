import { parseGameEnvelope } from '@/features/minigame/message-envelope';
import { TOWER_RULES } from '@/features/minigame/tower-engine';

/** What the game document reports: the ticks on which a drop was accepted. */
export type TowerFinish = { ticks: number; dropTicks: number[] };
/**
 * 서버 제출 형태 — 탑 쌓기는 러너의 요청 필드(`jumpTicks`)를 그대로 재사용한다.
 * 떨어뜨린 틱이 곧 `jumpTicks`다.
 */
export type TowerReplay = { ticks: number; jumpTicks: number[] };

export type TowerGameProps = {
  seed: number;
  active?: boolean;
  practice?: boolean;
  onFinish: (replay: TowerReplay) => void;
  onPauseChange?: (paused: boolean) => void;
  testID?: string;
};

export type TowerMessage =
  | { channelId: string; type: 'ready' }
  | { channelId: string; type: 'pause'; paused: boolean }
  | { channelId: string; type: 'finish'; result: TowerFinish };

export function towerReplay(result: TowerFinish): TowerReplay {
  return { ticks: result.ticks, jumpTicks: [...result.dropTicks] };
}

/** An iframe/WebView message is untrusted even though its document is bundled. */
export function parseTowerMessage(raw: unknown, channelId: string): TowerMessage | null {
  const value = parseGameEnvelope(raw, channelId, 120000);
  if (!value) return null;
  if (value.type === 'ready') return { channelId, type: 'ready' };
  if (value.type === 'pause' && typeof value.paused === 'boolean') {
    return { channelId, type: 'pause', paused: value.paused };
  }
  if (value.type !== 'finish' || !value.result || typeof value.result !== 'object') return null;
  const result = value.result as Record<string, unknown>;
  const ticks = result.ticks;
  const dropTicks = result.dropTicks;
  if (
    typeof ticks !== 'number' ||
    !Number.isInteger(ticks) ||
    ticks < 1 ||
    ticks > TOWER_RULES.maxTicks ||
    !Array.isArray(dropTicks) ||
    dropTicks.length > TOWER_RULES.maxDrops
  )
    return null;
  // 엔진은 쿨다운(6틱) 안의 입력을 기록하지 않으므로 간격이 그보다 좁으면 조작된 기록이다.
  let previous = -TOWER_RULES.inputCooldown;
  for (const tick of dropTicks) {
    if (
      typeof tick !== 'number' ||
      !Number.isInteger(tick) ||
      tick < 1 ||
      tick > ticks ||
      tick - previous < TOWER_RULES.inputCooldown
    )
      return null;
    previous = tick;
  }
  return { channelId, type: 'finish', result: { ticks, dropTicks: [...dropTicks] } };
}
