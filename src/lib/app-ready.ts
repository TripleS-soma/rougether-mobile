/**
 * 부팅 준비 신호 (#847) — 스플래시가 "시간"이 아니라 "준비"를 기다리게 한다.
 *
 * `AppRoot`는 두 관문을 순서대로 통과해야 화면을 그린다: 세션 복원
 * (`status === 'loading'`)과 온보딩 플래그(`onboarded === null`). 둘 다
 * AsyncStorage 읽기이고 **직렬**이라(두 번째는 첫 번째가 끝나야 시작), 느린
 * 기기·콜드 스타트에서 스플래시 최소 노출(1200ms)보다 오래 걸릴 수 있다.
 * 그러면 오버레이는 타이머만 보고 걷히는데 AppRoot는 아직 `return null`이라
 * **빈 화면이 드러난다.**
 *
 * 컨텍스트가 아니라 모듈 스토어인 이유: 오버레이(`_layout.tsx`)와 `onboarded`
 * 상태(AppRoot 지역 state)는 트리에서 서로 볼 수 없다. `onSessionCleared`
 * (api/auth.ts)와 같은 결의 구독 창구를 하나 더 둔다.
 */
type Listener = () => void;

let ready = false;
const listeners = new Set<Listener>();

/** 그릴 준비가 됐는지 — 구독 전에 이미 준비됐을 수 있어 구독자가 먼저 확인한다. */
export function isAppReady(): boolean {
  return ready;
}

/**
 * 준비 완료를 알린다. 여러 번 불러도 첫 호출만 유효하다 — AppRoot가 렌더마다
 * 부를 수 있고, 재알림은 이미 걷힌 스플래시에 아무 의미가 없다.
 */
export function markAppReady(): void {
  if (ready) return;
  ready = true;
  listeners.forEach((l) => l());
}

/** 준비 완료 구독. 반환값은 해지 함수. */
export function onAppReady(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 테스트 전용 — 모듈 스토어라 테스트 간에 상태가 새는 걸 막는다. */
export function resetAppReadyForTest(): void {
  ready = false;
  listeners.clear();
}
