import { parseGameEnvelope } from '@/features/minigame/message-envelope';

export type RunnerFinish = { ticks: number; jumpTicks: number[] };

export type RunnerGameProps = {
  seed: number;
  active?: boolean;
  practice?: boolean;
  onFinish: (result: RunnerFinish) => void;
  onPauseChange?: (paused: boolean) => void;
  testID?: string;
};

export type RunnerMessage =
  | { channelId: string; type: 'ready' }
  | { channelId: string; type: 'pause'; paused: boolean }
  | { channelId: string; type: 'finish'; result: RunnerFinish };

/** An iframe/WebView message is untrusted even though its document is bundled. */
export function parseRunnerMessage(raw: unknown, channelId: string): RunnerMessage | null {
  const value = parseGameEnvelope(raw, channelId, 120000);
  if (!value) return null;
  if (value.type === 'ready') return { channelId, type: 'ready' };
  if (value.type === 'pause' && typeof value.paused === 'boolean') {
    return { channelId, type: 'pause', paused: value.paused };
  }
  if (value.type !== 'finish' || !value.result || typeof value.result !== 'object') {
    return null;
  }
  const result = value.result as Record<string, unknown>;
  const ticks = result.ticks;
  const jumpTicks = result.jumpTicks;
  if (
    typeof ticks !== 'number' ||
    !Number.isInteger(ticks) ||
    ticks < 1 ||
    ticks > 18000 ||
    !Array.isArray(jumpTicks) ||
    jumpTicks.length > 563
  ) {
    return null;
  }
  let previous = 0;
  for (const tick of jumpTicks) {
    if (!Number.isInteger(tick) || tick <= previous || tick > ticks) return null;
    previous = tick;
  }
  return { channelId, type: 'finish', result: { ticks, jumpTicks: [...jumpTicks] } };
}
