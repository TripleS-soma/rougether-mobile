import { parseGameEnvelope } from '@/features/minigame/message-envelope';

export type MergeDirection = 'UP' | 'RIGHT' | 'DOWN' | 'LEFT';
export type MergeAction = { tick: number; direction: MergeDirection };
export type MergeFinish = { ticks: number; actions: MergeAction[] };

export type MergeGameProps = {
  seed: number;
  active?: boolean;
  practice?: boolean;
  onFinish: (result: MergeFinish) => void;
  onPauseChange?: (paused: boolean) => void;
  testID?: string;
};

export type MergeMessage =
  | { channelId: string; type: 'ready' }
  | { channelId: string; type: 'pause'; paused: boolean }
  | { channelId: string; type: 'finish'; result: MergeFinish };

/** Validate isolated document messages before they reach the API mutation. */
export function parseMergeMessage(raw: unknown, channelId: string): MergeMessage | null {
  const value = parseGameEnvelope(raw, channelId, 160000);
  if (!value) return null;
  if (value.type === 'ready') return { channelId, type: 'ready' };
  if (value.type === 'pause' && typeof value.paused === 'boolean') {
    return { channelId, type: 'pause', paused: value.paused };
  }
  if (value.type !== 'finish' || !value.result || typeof value.result !== 'object') return null;
  const result = value.result as Record<string, unknown>;
  const { ticks, actions } = result;
  if (
    typeof ticks !== 'number' ||
    !Number.isInteger(ticks) ||
    ticks < 1 ||
    ticks > 18000 ||
    !Array.isArray(actions) ||
    actions.length > 2000
  )
    return null;
  let previous = 0;
  const copied: MergeAction[] = [];
  for (const action of actions) {
    if (!action || typeof action !== 'object') return null;
    const { tick, direction } = action as Record<string, unknown>;
    if (
      typeof tick !== 'number' ||
      !Number.isInteger(tick) ||
      tick <= previous ||
      tick > ticks ||
      (direction !== 'UP' && direction !== 'RIGHT' && direction !== 'DOWN' && direction !== 'LEFT')
    )
      return null;
    previous = tick;
    copied.push({ tick, direction });
  }
  return { channelId, type: 'finish', result: { ticks, actions: copied } };
}
