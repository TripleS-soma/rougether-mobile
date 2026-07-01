import * as Haptics from 'expo-haptics';

/**
 * Fire-and-forget haptic feedback helpers. Each swallows errors so callers can
 * trigger them inline in press handlers; they no-op where haptics are
 * unsupported (web, simulators). Semantic names keep call sites intent-first.
 */
export function hapticSelection() {
  Haptics.selectionAsync().catch(() => {});
}

export function hapticImpact(
  style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium,
) {
  Haptics.impactAsync(style).catch(() => {});
}

export function hapticSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
