import { parseGameEnvelope } from '@/features/minigame/message-envelope';
import type { RhythmResult } from '@/features/minigame/rhythm-model';

export type RhythmGameProps = {
  active?: boolean;
  onFinish?: (result: RhythmResult) => void;
};

export function parseRhythmMessage(raw: unknown, channelId: string) {
  const message = parseGameEnvelope(raw, channelId, 80000);
  if (!message) return null;
  if (message.type === 'ready' || message.type === 'error') return { type: message.type };
  if (message.type === 'pause' && typeof message.paused === 'boolean') return { type: 'pause' };
  if (message.type !== 'finish' || !message.result || typeof message.result !== 'object')
    return null;
  const r = message.result as RhythmResult;
  if (
    r.chartVersion !== 2 ||
    ![r.perfect, r.good, r.miss, r.maxCombo, r.score].every(Number.isInteger) ||
    r.perfect < 0 ||
    r.good < 0 ||
    r.miss < 0 ||
    r.perfect + r.good + r.miss !== 32 ||
    r.maxCombo < 0 ||
    r.maxCombo > r.perfect + r.good ||
    r.score !== r.perfect * 1000 + r.good * 500 ||
    !Array.isArray(r.actions) ||
    r.actions.length > 1024
  )
    return null;
  let previous = -1;
  for (const action of r.actions) {
    if (
      !action ||
      !['press', 'release'].includes(action.kind) ||
      !Number.isInteger(action.timeMs) ||
      action.timeMs < previous ||
      action.timeMs > 90000 ||
      action.timeMs < 0
    )
      return null;
    previous = action.timeMs;
  }
  return { type: 'finish', result: { ...r, actions: r.actions.map((a) => ({ ...a })) } };
}
