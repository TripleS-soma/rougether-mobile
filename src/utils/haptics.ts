import * as Haptics from 'expo-haptics';

/**
 * Fire-and-forget haptic feedback helpers. Each swallows errors so callers can
 * trigger them inline in press handlers; they no-op where haptics are
 * unsupported (web, simulators). Semantic names keep call sites intent-first.
 *
 * 전역 게이트 (#586 → 세기 단계 #974): 설정 > 효과음의 '햅틱 진동'이 여기를
 * 통해 모든 햅틱의 세기를 정한다 — 셸이 설정 로드/변경 시 `setHapticStrength`로
 * 주입하고, 콜사이트는 그대로 부르면 된다.
 */
export type HapticStrength = 'off' | 'light' | 'medium' | 'heavy';

export const DEFAULT_HAPTIC_STRENGTH: HapticStrength = 'medium';

let strength: HapticStrength = DEFAULT_HAPTIC_STRENGTH;

export function setHapticStrength(value: HapticStrength) {
  strength = value;
}

/** 테스트·디버그용 — 현재 게이트 상태. */
export function getHapticStrength(): HapticStrength {
  return strength;
}

/**
 * 선택 틱 (토글·휠 등 가장 잦은 햅틱).
 *
 * `selectionAsync`에는 세기 인자가 없어서, 세기를 따르게 하려면 임팩트로
 * 갈아끼우는 수밖에 없다 (#974). iOS 기준 selection은 Light와 Medium 사이라
 * **약은 Light, 강은 Medium 임팩트**로 두고 보통만 원래 selection을 쓴다.
 */
export function hapticSelection() {
  if (strength === 'off') return;
  if (strength === 'light') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    return;
  }
  if (strength === 'heavy') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    return;
  }
  Haptics.selectionAsync().catch(() => {});
}

/** 세기 단계별 임팩트. 보통일 때만 호출부가 넘긴 style을 존중한다. */
export function hapticImpact(
  style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium,
) {
  if (strength === 'off') return;
  const scaled =
    strength === 'light'
      ? Haptics.ImpactFeedbackStyle.Light
      : strength === 'heavy'
        ? Haptics.ImpactFeedbackStyle.Heavy
        : style;
  Haptics.impactAsync(scaled).catch(() => {});
}

/**
 * 완료 알림. **세기를 따르지 않는다** — `notificationAsync`는 두둔두둔하는 고유
 * 리듬이라, 세기를 맞추자고 단일 임팩트로 바꾸면 '완료됐다'는 뜻이 사라진다
 * (#974에서 그렇게 합의). 끄기에서만 침묵한다.
 */
export function hapticSuccess() {
  if (strength === 'off') return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
