/** Only messages carrying this document's channel may affect its lifecycle. */
export function parseGameEnvelope(
  raw: unknown,
  channelId: string,
  maxLength = 160000,
): Record<string, unknown> | null {
  let message: unknown = raw;
  if (typeof raw === 'string') {
    if (raw.length > maxLength) return null;
    try {
      message = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!message || typeof message !== 'object') return null;
  const value = message as Record<string, unknown>;
  return value.channelId === channelId ? value : null;
}

/** Called only after the platform has checked the message's source. */
export function isCurrentGameFinish(raw: unknown, channelId: string): boolean {
  return parseGameEnvelope(raw, channelId)?.type === 'finish';
}
