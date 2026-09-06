type IconEvent = 'foreground' | 'completion';
const listeners = new Set<(event: IconEvent) => void>();
export function onAppIconEvent(listener: (event: IconEvent) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function notifyAppIconEvent(event: IconEvent) {
  for (const listener of listeners) listener(event);
}
export const notifyAppForegroundInteraction = () => notifyAppIconEvent('foreground');
