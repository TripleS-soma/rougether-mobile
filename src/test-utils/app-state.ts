import { AppState, type AppStateStatus } from 'react-native';

/**
 * AppState 스파이 — 리스너를 잡아 두고 테스트가 `emit('background')`로 흘려보낸다.
 * 훅을 스스로 등록하지 않는다(jest-circus는 테스트 안에서 훅 등록을 금지하므로):
 * 테스트 안에서 부르면 그 테스트 동안만, `beforeEach`에서 부르면 매 테스트 새로
 * 걸리고 `afterEach(() => spy.restore())`로 되돌린다.
 */
export function spyAppState(initial: AppStateStatus = AppState.currentState) {
  const listeners = new Set<(state: AppStateStatus) => void>();
  const removes: jest.Mock[] = [];
  const original = AppState.currentState;
  AppState.currentState = initial;
  const spy = jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_type, listener: (state: AppStateStatus) => void) => {
      listeners.add(listener);
      const remove = jest.fn(() => listeners.delete(listener));
      removes.push(remove);
      return { remove };
    });
  return {
    /** 현재 상태를 바꾸고 등록된 리스너 전부에 알린다. */
    emit(state: AppStateStatus) {
      AppState.currentState = state;
      for (const l of Array.from(listeners)) l(state);
    },
    setCurrent(state: AppStateStatus) {
      AppState.currentState = state;
    },
    get listenerCount() {
      return listeners.size;
    },
    /** 구독 해제 스파이들 — `expect(removes[0]).toHaveBeenCalled()`. */
    removes,
    restore() {
      spy.mockRestore();
      AppState.currentState = original;
      listeners.clear();
    },
  };
}
