import { useSyncExternalStore } from 'react';

const mounted = new Set<symbol>();
const listeners = new Set<() => void>();
const publish = () => listeners.forEach((listener) => listener());

/** Track the rendered lifetime, including exit animation, of ordinary app sheets. */
export function registerAppSheet() {
  const id = Symbol();
  mounted.add(id);
  publish();
  return () => {
    mounted.delete(id);
    publish();
  };
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const useAppSheetPresent = () =>
  useSyncExternalStore(
    subscribe,
    () => mounted.size > 0,
    () => false,
  );

const priority = new Set<symbol>();
const priorityListeners = new Set<() => void>();
export function registerPriorityModal() {
  const id = Symbol();
  priority.add(id);
  priorityListeners.forEach((fn) => fn());
  return () => {
    priority.delete(id);
    priorityListeners.forEach((fn) => fn());
  };
}
export const usePriorityModalPresent = () =>
  useSyncExternalStore(
    (listener) => {
      priorityListeners.add(listener);
      return () => {
        priorityListeners.delete(listener);
      };
    },
    () => priority.size > 0,
    () => false,
  );
