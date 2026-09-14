import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Overlay, Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import type { SocialProvider } from '@/lib/last-login';
import { providerLabel } from '@/lib/login-conflict';
import { i18n, useT } from '@/i18n';

export type LoginConflictDialogProps = {
  visible: boolean;
  /** 서버 안내 문구 — "이 이메일은 애플 로그인으로 가입되어 있어요." */
  message: string;
  /** 같은 이메일로 이미 가입된 provider들. */
  providers: SocialProvider[];
  /** [OO로 로그인] — 기존 provider가 하나이고 이 플랫폼에서 쓸 수 있을 때만 노출. */
  onLoginWith: (provider: SocialProvider) => void;
  /** [새 계정으로 계속] — allowNewAccount 재요청. */
  onContinueAsNew: () => void;
  /** 닫기 버튼 + 배경 탭 + Android back — 아무것도 하지 않고 로그인 화면으로. */
  onDismiss: () => void;
  /** Modal 이 완전히 닫힌 뒤(iOS onDismiss) — 네이티브 시트를 이어서 띄울 때 쓴다. */
  onClosed?: () => void;
};

/**
 * 같은 이메일 타 provider 계정 안내 (서버 409 AUTH_EMAIL_LINKED_TO_OTHER_PROVIDER).
 * 버튼이 셋(기존 provider 로그인 · 새 계정 · 닫기)이라 공용 ConfirmDialog 대신
 * 화면 전용으로 둔다 — ConfirmDialog 는 배경 탭이 cancel 과 같은 동작이라
 * "새 계정으로 계속" 같은 되돌리기 어려운 선택을 거기에 실을 수 없다.
 */
export function LoginConflictDialog({
  visible,
  message,
  providers,
  onLoginWith,
  onContinueAsNew,
  onDismiss,
  onClosed,
}: LoginConflictDialogProps) {
  const t = useTokens();
  const tr = useT();
  const Typography = useTypography();
  const existing = providers.length === 1 ? providers[0] : null;
  // Sign in with Apple 은 iOS 전용 — 다른 플랫폼에선 동작할 수 없는 버튼을 보여주지 않는다.
  const canUseExisting = existing != null && (existing !== 'apple' || Platform.OS === 'ios');
  const guide = guideText(providers, existing, canUseExisting);
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onDismiss}
      onDismiss={onClosed}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        {/* Inner Pressable swallows taps so the card doesn't dismiss itself. */}
        <Pressable style={[styles.card, { backgroundColor: t.screen }]}>
          <Text style={[Typography.h3, { color: t.text }]}>
            {tr('member.login.conflict.title')}
          </Text>
          <Text style={[Typography.body, styles.body, { color: t.textMuted }]}>
            {message}
            {'\n'}
            {guide}
          </Text>
          <View style={styles.btns}>
            {canUseExisting ? (
              <Pressable
                onPress={() => onLoginWith(existing)}
                accessibilityRole="button"
                accessibilityLabel={tr('member.login.conflict.loginWith', {
                  provider: providerLabel(existing),
                })}
                style={[styles.btn, { backgroundColor: t.primary }]}>
                <Text style={[Typography.label, { color: t.onPrimary }]}>
                  {tr('member.login.conflict.loginWith', { provider: providerLabel(existing) })}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={onContinueAsNew}
              accessibilityRole="button"
              accessibilityLabel={tr('member.login.conflict.continueAsNew')}
              style={[styles.btn, { backgroundColor: t.surfaceMuted }]}>
              <Text style={[Typography.label, { color: t.text }]}>
                {tr('member.login.conflict.continueAsNew')}
              </Text>
            </Pressable>
            <Pressable
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel={tr('member.common.close')}
              style={styles.textBtn}>
              <Text style={[Typography.label, { color: t.textMuted }]}>
                {tr('member.common.close')}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// 안내 문구는 사용자가 실제로 할 수 있는 행동만 가리킨다 — Android 에는 애플 버튼이 없고,
// provider 가 둘 이상이면 다이얼로그에 버튼을 두지 않으므로 "닫고 직접 누르라"고 알린다.
function guideText(
  providers: SocialProvider[],
  existing: SocialProvider | null,
  canUseExisting: boolean,
): string {
  if (existing != null && canUseExisting) {
    return i18n.t('member.login.conflict.guideUseExisting', { provider: providerLabel(existing) });
  }
  if (existing != null) {
    return i18n.t('member.login.conflict.guideUnavailable', { provider: providerLabel(existing) });
  }
  if (providers.length > 1) {
    const labels = providers.map(providerLabel).join('·');
    return i18n.t('member.login.conflict.guideMultiple', { labels });
  }
  return i18n.t('member.login.conflict.guideUnknown');
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Overlay.dim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '80%',
    maxWidth: 340,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  body: {
    lineHeight: 24,
  },
  btns: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  btn: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  textBtn: {
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
});
