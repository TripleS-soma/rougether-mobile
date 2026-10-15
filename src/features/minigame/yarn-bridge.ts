import { parseGameEnvelope } from '@/features/minigame/message-envelope';
import { YARN_RULES } from '@/features/minigame/yarn-engine';

/**
 * 털실 정리의 제출 형태 — 문서가 보내는 것과 서버로 보내는 것이 같다.
 * `ticks`는 시계가 아니라 집은 횟수(최소 1)이고, `picks`는 집은 더미 번호(0..5) 순서다.
 */
export type YarnFinish = { ticks: number; picks: number[] };

export type YarnGameProps = {
  seed: number;
  active?: boolean;
  practice?: boolean;
  onFinish: (replay: YarnFinish) => void;
  onPauseChange?: (paused: boolean) => void;
  testID?: string;
};

export type YarnMessage =
  | { channelId: string; type: 'ready' }
  | { channelId: string; type: 'pause'; paused: boolean }
  | { channelId: string; type: 'finish'; result: YarnFinish };

/** An iframe/WebView message is untrusted even though its document is bundled. */
export function parseYarnMessage(raw: unknown, channelId: string): YarnMessage | null {
  const value = parseGameEnvelope(raw, channelId, 40000);
  if (!value) return null;
  if (value.type === 'ready') return { channelId, type: 'ready' };
  if (value.type === 'pause' && typeof value.paused === 'boolean') {
    return { channelId, type: 'pause', paused: value.paused };
  }
  if (value.type !== 'finish' || !value.result || typeof value.result !== 'object') return null;
  const result = value.result as Record<string, unknown>;
  const { ticks, picks } = result;
  if (!Array.isArray(picks) || picks.length > YARN_RULES.maxPicks) return null;
  // 틱은 집은 횟수 그 자체 — 다르면 조작되었거나 깨진 기록이다.
  if (ticks !== Math.max(1, picks.length)) return null;
  for (const pile of picks) {
    if (typeof pile !== 'number' || !Number.isInteger(pile) || pile < 0 || pile >= YARN_RULES.piles)
      return null;
  }
  return { channelId, type: 'finish', result: { ticks, picks: [...(picks as number[])] } };
}
