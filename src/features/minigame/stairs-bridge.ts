import type { StairsInput } from '@/features/minigame/stairs-engine';

export type StairsFinish = { ticks: number; actions: StairsInput[] };
export type StairsGameProps = {
  seed: number;
  active?: boolean;
  practice?: boolean;
  onFinish: (result: StairsFinish) => void;
  onPauseChange?: (paused: boolean) => void;
  testID?: string;
};
export type StairsMessage =
  | { channelId: string; type: 'ready' }
  | { channelId: string; type: 'pause'; paused: boolean }
  | { channelId: string; type: 'finish'; result: StairsFinish };

/** Treat every WebView/iframe message as untrusted. */
export function parseStairsMessage(raw: unknown, channelId: string): StairsMessage | null {
  let message: unknown = raw;
  if (typeof raw === 'string') {
    if (raw.length > 120000) return null;
    try {
      message = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!message || typeof message !== 'object') return null;
  const value = message as Record<string, unknown>;
  if (value.channelId !== channelId) return null;
  if (value.type === 'ready') return { channelId, type: 'ready' };
  if (value.type === 'pause' && typeof value.paused === 'boolean') {
    return { channelId, type: 'pause', paused: value.paused };
  }
  if (value.type !== 'finish' || !value.result || typeof value.result !== 'object') return null;
  const result = value.result as Record<string, unknown>;
  const ticks = result.ticks;
  const actions = result.actions;
  if (
    typeof ticks !== 'number' ||
    !Number.isInteger(ticks) ||
    ticks < 1 ||
    ticks > 7200 ||
    !Array.isArray(actions) ||
    actions.length > 1200
  )
    return null;
  let previous = -5;
  const validated: StairsInput[] = [];
  for (const item of actions) {
    if (!item || typeof item !== 'object') return null;
    const { tick, direction } = item as Record<string, unknown>;
    if (
      typeof tick !== 'number' ||
      !Number.isInteger(tick) ||
      tick < 1 ||
      tick - previous < 6 ||
      tick > ticks ||
      (direction !== 'LEFT' && direction !== 'RIGHT')
    )
      return null;
    previous = tick;
    validated.push({ tick, direction });
  }
  return { channelId, type: 'finish', result: { ticks, actions: validated } };
}
