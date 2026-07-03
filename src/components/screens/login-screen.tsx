import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Field } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { useToast } from '@/components/ui/toast';
import { Radius, Spacing } from '@/constants/theme';
import { useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens } from '@/hooks/use-tokens';

export type LoginScreenProps = {
  onAuthSuccess?: () => void;
  onGoSignup?: () => void;
  /**
   * Sign in and start a session. The API currently offers only dev-login, so
   * the userId is taken from the email field (numeric; defaults to 1). Resolves
   * true on success. When omitted, submit just calls onAuthSuccess.
   */
  onLogin?: (userId: number) => Promise<boolean>;
};

/**
 * Login / auth entry screen, ported from the prototype `AuthScreen`.
 * Brand colors come from `useTokens()`; icons and the character avatar are
 * placeholders for now (TODO: port the character system, add an icon set).
 * Field/SocialButton are kept local — extract to `components/ui` once a second
 * screen needs them.
 */
export function LoginScreen({ onAuthSuccess, onGoSignup, onLogin }: LoginScreenProps) {
  const t = useTokens();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [keepLogin, setKeepLogin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { show: toast } = useToast();

  const canSubmit = email.length > 0 && password.length > 0 && !submitting;
  // 비밀번호 찾기 / social sign-in have no backend yet — say so instead of
  // silently doing nothing.
  const notReady = () => toast('아직 준비 중이에요');

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    // Dev-login: userId comes from the email field (numeric), else 1.
    const parsed = Number.parseInt(email, 10);
    const userId = Number.isFinite(parsed) ? parsed : 1;
    const ok = onLogin ? await onLogin(userId) : true;
    setSubmitting(false);
    if (ok) onAuthSuccess?.();
    else setError('로그인에 실패했어요. userId를 확인하고 다시 시도해 주세요.');
  };

  return (
    <View style={[styles.screen, useScreenStyle()]}>
      <View style={styles.header}>
        {/* TODO: replace with the ported CharacterAvatar */}
        <View style={[styles.avatar, { backgroundColor: t.surfaceMuted }]}>
          <Text style={styles.avatarGlyph}>🐱</Text>
        </View>
        <Text style={[styles.title, { color: t.text }]}>루게더</Text>
        <Text style={[styles.subtitle, { color: t.textMuted }]}>
          매일의 루틴으로 나만의 방과 집을 함께 키워요.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: t.surface, shadowColor: '#000' }]}>
        <Field
          placeholder="이메일"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Field
          placeholder="비밀번호"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPw}
          trailing={
            <Pressable onPress={() => setShowPw((v) => !v)} accessibilityRole="button">
              <Text style={[styles.smallLink, { color: t.textMuted }]}>
                {showPw ? '숨김' : '보기'}
              </Text>
            </Pressable>
          }
        />

        <View style={styles.row}>
          <Pressable
            style={styles.checkboxRow}
            onPress={() => setKeepLogin((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: keepLogin }}>
            <View
              style={[
                styles.checkbox,
                { borderColor: t.border },
                keepLogin && { backgroundColor: t.primary, borderColor: t.primary },
              ]}>
              {keepLogin ? <Icon name="check" size={12} color={t.onPrimary} /> : null}
            </View>
            <Text style={[styles.smallText, { color: t.textMuted }]}>로그인 유지</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={notReady}>
            <Text style={[styles.smallLink, { color: t.primary }]}>비밀번호 찾기</Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        disabled={!canSubmit}
        onPress={submit}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.submit,
          { backgroundColor: canSubmit ? t.primary : t.disabledBg },
          pressed && canSubmit && { backgroundColor: t.primaryActive },
        ]}>
        <Text style={[styles.submitText, { color: t.onPrimary }]}>
          {submitting ? '로그인 중…' : '로그인'}
        </Text>
      </Pressable>
      {error ? (
        <Text style={[styles.errorText, { color: t.danger }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Text style={[styles.devHint, { color: t.textMuted }]}>
        개발 로그인: 이메일 칸에 userId(숫자)를 넣으면 그 계정으로, 비우면 1번으로 접속돼요.
      </Text>

      <View style={styles.divider}>
        <View style={[styles.line, { backgroundColor: t.border }]} />
        <Text style={[styles.smallText, { color: t.textMuted }]}>간편 로그인</Text>
        <View style={[styles.line, { backgroundColor: t.border }]} />
      </View>

      <View style={styles.social}>
        <SocialButton
          bg="#FEE500"
          textColor="#3C1E1E"
          label="카카오"
          glyph="K"
          onPress={notReady}
        />
        <SocialButton
          bg="#03C75A"
          textColor="#FFFFFF"
          label="네이버"
          glyph="N"
          onPress={notReady}
        />
        <SocialButton
          bg="#FFFFFF"
          textColor="#4A403A"
          label="구글"
          glyph="G"
          bordered
          onPress={notReady}
        />
      </View>

      <View style={styles.footer}>
        <Text style={[styles.smallText, { color: t.textMuted }]}>아직 회원이 아니신가요? </Text>
        <Pressable onPress={onGoSignup} accessibilityRole="button">
          <Text style={[styles.smallLink, { color: t.primary }]}>회원가입</Text>
        </Pressable>
      </View>
    </View>
  );
}

type SocialButtonProps = {
  bg: string;
  textColor: string;
  label: string;
  glyph: string;
  bordered?: boolean;
  onPress?: () => void;
};

function SocialButton({ bg, textColor, label, glyph, bordered, onPress }: SocialButtonProps) {
  const t = useTokens();
  return (
    <Pressable
      style={styles.socialItem}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}로 시작`}>
      <View
        style={[
          styles.socialCircle,
          { backgroundColor: bg },
          bordered && { borderWidth: StyleSheet.hairlineWidth, borderColor: t.border },
        ]}>
        <Text style={[styles.socialGlyph, { color: textColor }]}>{glyph}</Text>
      </View>
      <Text style={[styles.smallText, { color: t.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
  },
  header: {
    alignItems: 'center',
    paddingTop: Spacing.six,
    paddingBottom: Spacing.four,
    gap: Spacing.one,
  },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  avatarGlyph: {
    fontSize: 56,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.three,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submit: {
    marginTop: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
    alignItems: 'center',
  },
  submitText: {
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  devHint: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginVertical: Spacing.four,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  social: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.four,
  },
  socialItem: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  socialCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialGlyph: {
    fontSize: 20,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.four,
  },
  smallText: {
    fontSize: 12,
  },
  smallLink: {
    fontSize: 12,
    fontWeight: '600',
  },
});
