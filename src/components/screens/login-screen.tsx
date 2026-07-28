import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { type ReactNode, useState } from 'react';
import Svg, { Path } from 'react-native-svg';
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
  /** 이메일 가입 잠정 제외 — 진입 링크가 주석 처리돼 현재는 미사용. */
  onGoSignup?: () => void;
  /**
   * Dev-login (개발 빌드 전용 폼): a numeric userId in the email field signs
   * into that account; an empty (or non-numeric) field creates a FRESH user
   * server-side. Resolves true on success. When omitted, submit just calls
   * onAuthSuccess.
   */
  onLogin?: (userId?: number) => Promise<boolean>;
  /**
   * 구글 로그인 (#489) — 계정 시트 → 서버 교환까지 수행하고 결과를 돌려준다.
   * 'cancelled'는 조용히 무시, 'failed'만 에러로 알린다.
   */
  onGoogleLogin?: () => Promise<'ok' | 'cancelled' | 'failed'>;
  /** 카카오 로그인 (#489 소셜 2차) — 시맨틱은 onGoogleLogin과 동일. */
  onKakaoLogin?: () => Promise<'ok' | 'cancelled' | 'failed'>;
  /** 애플 로그인 (#489 소셜 3차) — iOS 전용 버튼(다른 플랫폼에선 숨김). */
  onAppleLogin?: () => Promise<'ok' | 'cancelled' | 'failed'>;
};

/**
 * Login / auth entry screen, ported from the prototype `AuthScreen`.
 * Brand colors come from `useTokens()`; icons and the character avatar are
 * placeholders for now (TODO: port the character system, add an icon set).
 * Field/SocialButton are kept local — extract to `components/ui` once a second
 * screen needs them.
 */
export function LoginScreen({
  onAuthSuccess,
  onGoSignup,
  onLogin,
  onGoogleLogin,
  onKakaoLogin,
  onAppleLogin,
}: LoginScreenProps) {
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

  // 소셜 로그인 (#489) — 취소는 조용히, 실패만 에러 문구로.
  const submitSocial = async (
    login: (() => Promise<'ok' | 'cancelled' | 'failed'>) | undefined,
    failMessage: string,
  ) => {
    if (submitting || !login) return;
    setSubmitting(true);
    setError(null);
    const result = await login();
    setSubmitting(false);
    if (result === 'ok') onAuthSuccess?.();
    else if (result === 'failed') setError(failMessage);
  };
  const submitGoogle = () =>
    submitSocial(onGoogleLogin, '구글 로그인에 실패했어요. 잠시 후 다시 시도해 주세요.');
  const submitKakao = () =>
    submitSocial(onKakaoLogin, '카카오 로그인에 실패했어요. 잠시 후 다시 시도해 주세요.');
  const submitApple = () =>
    submitSocial(onAppleLogin, '애플 로그인에 실패했어요. 잠시 후 다시 시도해 주세요.');

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

          {/* dev-login 폼(#489) — 개발 빌드 전용. 배포 빌드는 소셜 로그인만. */}
          {__DEV__ ? (
            <>
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
            </>
          ) : null}
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

          {/* 브랜드 로고 카드 열 (#524) — 원형 아이콘 3개에서 전폭 버튼
              스택으로. 브랜드 규정색 유지, 접근성 라벨은 기존 계약 그대로. */}
          <View style={styles.social}>
            <SocialButton
              bg="#FEE500"
              textColor="#191919"
              label="카카오"
              logo={<Ionicons name="chatbubble" size={18} color="#191919" />}
              onPress={onKakaoLogin ? submitKakao : notReady}
            />
            {/* Sign in with Apple은 iOS 전용(expo-apple-authentication) — 다른
                플랫폼에선 동작할 수 없는 버튼을 보여주지 않는다 (#489 소셜 3차). */}
            {Platform.OS === 'ios' ? (
              <SocialButton
                bg="#000000"
                textColor="#FFFFFF"
                label="애플"
                logo={<Ionicons name="logo-apple" size={20} color="#FFFFFF" />}
                onPress={onAppleLogin ? submitApple : notReady}
              />
            ) : null}
            <SocialButton
              bg="#FFFFFF"
              textColor="#4A403A"
              label="구글"
              logo={<GoogleG size={18} />}
              bordered
              onPress={onGoogleLogin ? submitGoogle : notReady}
            />
          </View>

          {/* 이메일 가입 잠정 제외 — 소셜 로그인만 제공. 이메일 가입을
              되살릴 때 아래 회원가입 진입 링크를 복구할 것.
          <View style={styles.footer}>
            <Text style={[styles.smallText, { color: t.textMuted }]}>아직 회원이 아니신가요? </Text>
            <Pressable onPress={onGoSignup} accessibilityRole="button">
              <Text style={[styles.smallLink, emph('semibold'), { color: t.primaryText }]}>
                회원가입
              </Text>
            </Pressable>
          </View> */}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** 구글 공식 4색 G 마크 — 카드 버튼용 (#524). */
function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

type SocialButtonProps = {
  bg: string;
  textColor: string;
  label: string;
  logo: ReactNode;
  bordered?: boolean;
  onPress?: () => void;
};

function SocialButton({ bg, textColor, label, logo, bordered, onPress }: SocialButtonProps) {
  const t = useTokens();
  const emph = useFontEmphasis();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.socialCard,
        { backgroundColor: bg },
        bordered && { borderWidth: StyleSheet.hairlineWidth, borderColor: t.border },
        pressed && styles.socialCardPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}로 시작`}>
      <View style={styles.socialLogo}>{logo}</View>
      <Text style={[styles.socialLabel, emph('semibold'), { color: textColor }]}>
        {label === '구글' ? 'Google로 시작하기' : `${label}로 시작하기`}
      </Text>
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
    gap: Spacing.two,
  },
  socialCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Radius.md,
  },
  socialCardPressed: {
    opacity: 0.85,
  },
  socialLogo: {
    position: 'absolute',
    left: Spacing.four,
  },
  socialLabel: {
    fontSize: 15,
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
