import { Image } from 'expo-image';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import appIcon from '@/assets/images/icon.png';
import { Field } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { useToast } from '@/components/ui/toast';
import { Radius, Spacing } from '@/constants/theme';
import { useScreenStyle } from '@/hooks/use-screen-style';
import { useFontEmphasis, useTokens } from '@/hooks/use-tokens';

export type LoginScreenProps = {
  onAuthSuccess?: () => void;
  onGoSignup?: () => void;
  /**
   * Sign in and start a session. The API currently offers only dev-login: a
   * numeric userId in the email field signs into that account; an empty (or
   * non-numeric) field creates a FRESH user server-side. Resolves true on
   * success. When omitted, submit just calls onAuthSuccess.
   */
  onLogin?: (userId?: number) => Promise<boolean>;
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
  const emph = useFontEmphasis();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [keepLogin, setKeepLogin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { show: toast } = useToast();

  // Dev-login: password is a formality; empty userId(email 칸) = new account.
  const canSubmit = password.length > 0 && !submitting;
  // 비밀번호 찾기 / social sign-in have no backend yet — say so instead of
  // silently doing nothing.
  const notReady = () => toast('서버 준비 중이에요');

  const submit = async () => {
    // Blocked taps explain themselves; only the in-flight state stays silent.
    if (submitting) return;
    if (password.length === 0) {
      toast('비밀번호를 입력해주세요', 'error');
      return;
    }
    setSubmitting(true);
    setError(null);
    // Dev-login: numeric userId from the email field signs into that account;
    // empty/non-numeric → undefined → the server creates a fresh user.
    const parsed = Number.parseInt(email, 10);
    const userId = Number.isFinite(parsed) ? parsed : undefined;
    const ok = onLogin ? await onLogin(userId) : true;
    setSubmitting(false);
    if (ok) onAuthSuccess?.();
    else setError('로그인에 실패했어요. userId를 확인하고 다시 시도해 주세요.');
  };

  return (
    <View style={[styles.screen, useScreenStyle(['top', 'bottom'])]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={[styles.avatar, { backgroundColor: t.surfaceMuted }]}>
              <Image
                source={appIcon}
                style={styles.avatarImg}
                contentFit="cover"
                accessibilityLabel="루게더 앱 아이콘"
              />
            </View>
            <Text style={[styles.title, emph('bold'), { color: t.text }]}>루게더</Text>
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
                  <Text style={[styles.smallLink, emph('semibold'), { color: t.textMuted }]}>
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
                <Text style={[styles.smallLink, emph('semibold'), { color: t.primaryText }]}>
                  비밀번호 찾기
                </Text>
              </Pressable>
            </View>
          </View>

          <Pressable
            disabled={submitting}
            onPress={submit}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit }}
            style={({ pressed }) => [
              styles.submit,
              { backgroundColor: canSubmit ? t.primary : t.disabledBg },
              pressed && canSubmit && { backgroundColor: t.primaryActive },
            ]}>
            <Text
              style={[
                styles.submitText,
                emph('semibold'),
                { color: canSubmit ? t.onPrimary : t.textMuted },
              ]}>
              {submitting ? '로그인 중…' : '로그인'}
            </Text>
          </Pressable>
          {error ? (
            <Text style={[styles.errorText, { color: t.danger }]} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
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
              bg="#000000"
              textColor="#FFFFFF"
              label="애플"
              glyph="A"
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
              <Text style={[styles.smallLink, emph('semibold'), { color: t.primaryText }]}>
                회원가입
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  const emph = useFontEmphasis();
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
        <Text style={[styles.socialGlyph, emph('bold'), { color: textColor }]}>{glyph}</Text>
      </View>
      <Text style={[styles.smallText, { color: t.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  // Generous edge padding so the submit/social buttons never hug the screen
  // edges; small screens scroll instead of clipping.
  body: {
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
  },
  header: {
    alignItems: 'center',
    paddingTop: Spacing.five,
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
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 24,
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
  },
  errorText: {
    fontSize: 13,
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
  },
});
