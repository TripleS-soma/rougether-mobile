import * as Haptics from 'expo-haptics';

/**
 * Fire-and-forget haptic feedback helpers. Each swallows errors so callers can
 * trigger them inline in press handlers; they no-op where haptics are
 * unsupported (web, simulators). Semantic names keep call sites intent-first.
 *
 * 전역 게이트 (#586): 설정 > 소리의 '햅틱 진동' 토글이 여기를 통해 모든
 * 햅틱을 켜고 끈다 — 셸이 설정 로드/변경 시 `setHapticsEnabled`로 주입하고,
 * 콜사이트는 그대로 부르면 된다. 기본은 on(설정 기본값과 동일).
 */
let enabled = true;

export function setHapticsEnabled(value: boolean) {
  enabled = value;
}

/** 테스트·디버그용 — 현재 게이트 상태. */
export function isHapticsEnabled(): boolean {
  return enabled;
}

export function hapticSelection() {
  if (!enabled) return;
  Haptics.selectionAsync().catch(() => {});
}

export function hapticImpact(
  style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium,
) {
  if (!enabled) return;
  Haptics.impactAsync(style).catch(() => {});
}

export function hapticSuccess() {
  if (!enabled) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
