import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Field } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { PawPictogram } from '@/components/ui/pictograms';
import { Radius, Spacing } from '@/constants/theme';
import { useToast } from '@/components/ui/toast';
import { useHeaderInsetStyle, useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens } from '@/hooks/use-tokens';

export type SignupScreenProps = {
  onBack?: () => void;
  /** Reserved for when the backend gains a signup endpoint (submit is disabled). */
  onSignupSuccess?: () => void;
};

/**
 * Signup screen, ported from the prototype `SignupScreen`. Shares `Field` with
 * the login screen; email + verification-code rows are custom (inline side
 * button) like the original. Icons are text placeholders for now.
 */
export function SignupScreen({ onBack }: SignupScreenProps) {
  const t = useTokens();
  const headerInset = useHeaderInsetStyle();
  const { show: toast } = useToast();

  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);

  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [codeError, setCodeError] = useState<string | null>(null);

  const [agreeAll, setAgreeAll] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);

  const emailValid = /^\S+@\S+\.\S+$/.test(email);
  const passwordValid = password.length >= 8;
  const passwordMatch = passwordConfirm.length > 0 && password === passwordConfirm;
  const nicknameError =
    nickname.length > 0 && (nickname.length < 2 || nickname.length > 10)
      ? '2~10자로 입력해주세요'
      : undefined;

  const toggleAll = (next: boolean) => {
    setAgreeAll(next);
    setAgreeTerms(next);
    setAgreePrivacy(next);
    setAgreeMarketing(next);
  };

  const syncAgreeAll = (terms: boolean, privacy: boolean, marketing: boolean) => {
    setAgreeAll(terms && privacy && marketing);
  };

  useEffect(() => {
    if (!codeSent || emailVerified || secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [codeSent, emailVerified, secondsLeft]);

  const handleEmailChange = (v: string) => {
    setEmail(v);
    // Changing the email invalidates any in-progress verification.
    setCodeSent(false);
    setEmailVerified(false);
    setVerificationCode('');
    setSecondsLeft(0);
    setCodeError(null);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const handleSendCode = () => {
    // Blocked taps explain themselves (이미 인증 완료만 구조적으로 죽여둔다).
    if (!emailValid) return toast('이메일 형식을 확인해주세요', 'error');
    if (secondsLeft > 150) return toast('잠시 후 다시 시도해주세요', 'error');
    setCodeSent(true);
    setSecondsLeft(180);
    setVerificationCode('');
    setCodeError(null);
  };

  const handleVerifyCode = () => {
    if (verificationCode.length !== 6) {
      setCodeError('6자리 인증번호를 입력해주세요');
      return;
    }
    if (secondsLeft <= 0) {
      setCodeError('인증 시간이 만료되었어요. 다시 발송해주세요');
      return;
    }
    setEmailVerified(true);
    setCodeError(null);
  };

  const sendDisabled = !emailValid || emailVerified || secondsLeft > 150;

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <View style={[styles.header, headerInset, { backgroundColor: t.surface }]}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          style={[styles.backBtn, { backgroundColor: t.surfaceMuted }]}>
          <Icon name="back" size={26} color={t.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: t.text }]}>회원가입</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.intro}>
        <View style={styles.introTitleRow}>
          <Text style={[styles.introTitle, { color: t.text }]}>마을의 새 친구를 환영해요</Text>
          <PawPictogram size={18} />
        </View>
        <Text style={[styles.introSub, { color: t.textMuted }]}>
          정보를 입력하고 나만의 루게더를 시작하세요
        </Text>
      </View>

      {/* The backend has no signup endpoint yet — be honest instead of a fake
          flow that bounces back to login. */}
      <View style={[styles.notice, { backgroundColor: `${t.warning}22`, borderColor: t.warning }]}>
        <Text style={[styles.noticeText, { color: t.text }]}>
          이메일 가입은 준비 중이에요. 지금은 로그인 화면에서 이메일 칸을 비우고 로그인하면 새
          계정이 만들어져요.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: t.surface }]}>
        <Field
          label="닉네임"
          placeholder="2~10자 닉네임"
          value={nickname}
          onChangeText={setNickname}
          error={nicknameError}
        />

        {/* Email + verification request (custom inline row) */}
        <View style={styles.fieldWrap}>
          <Text style={[styles.label, { color: t.textMuted }]}>이메일</Text>
          <View style={styles.inlineRow}>
            <View
              style={[
                styles.inputBox,
                { backgroundColor: t.surfaceMuted },
                {
                  borderColor:
                    email.length > 0 && !emailValid
                      ? t.danger
                      : emailVerified
                        ? t.primary
                        : 'transparent',
                },
              ]}>
              <TextInput
                style={[styles.input, { color: emailVerified ? t.textMuted : t.text }]}
                value={email}
                onChangeText={handleEmailChange}
                editable={!emailVerified}
                placeholder="example@email.com"
                placeholderTextColor={t.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {emailVerified ? <Icon name="check" size={16} color={t.primaryText} /> : null}
            </View>
            <Pressable
              onPress={handleSendCode}
              disabled={emailVerified}
              accessibilityRole="button"
              accessibilityState={{ disabled: sendDisabled }}
              style={[
                styles.sideBtn,
                { backgroundColor: sendDisabled ? t.disabledBg : t.primary },
              ]}>
              <Text
                style={[styles.sideBtnText, { color: sendDisabled ? t.textMuted : t.onPrimary }]}>
                {emailVerified ? '인증완료' : codeSent ? '재발송' : '인증요청'}
              </Text>
            </Pressable>
          </View>
          {email.length > 0 && !emailValid ? (
            <Text style={[styles.msg, { color: t.danger }]}>이메일 형식이 올바르지 않아요</Text>
          ) : null}
          {emailVerified ? (
            <Text style={[styles.msg, { color: t.primaryText }]}>이메일 인증이 완료되었어요</Text>
          ) : null}
        </View>

        {/* Verification code (custom inline row) */}
        {codeSent && !emailVerified ? (
          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { color: t.textMuted }]}>인증번호</Text>
            <View style={styles.inlineRow}>
              <View
                style={[
                  styles.inputBox,
                  { backgroundColor: t.surfaceMuted },
                  { borderColor: codeError ? t.danger : 'transparent' },
                ]}>
                <TextInput
                  style={[styles.input, styles.code, { color: t.text }]}
                  value={verificationCode}
                  onChangeText={(v) => setVerificationCode(v.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6자리 인증번호"
                  placeholderTextColor={t.textMuted}
                  keyboardType="number-pad"
                  maxLength={6}
                />
                {secondsLeft > 0 ? (
                  <Text style={[styles.timer, { color: t.warningText }]}>
                    {formatTime(secondsLeft)}
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={handleVerifyCode}
                accessibilityRole="button"
                accessibilityState={{ disabled: verificationCode.length !== 6 }}
                style={[
                  styles.sideBtn,
                  { backgroundColor: verificationCode.length !== 6 ? t.disabledBg : t.text },
                ]}>
                <Text
                  style={[
                    styles.sideBtnText,
                    { color: verificationCode.length !== 6 ? t.textMuted : t.onPrimary },
                  ]}>
                  확인
                </Text>
              </Pressable>
            </View>
            <Text style={[styles.msg, { color: codeError ? t.danger : t.textMuted }]}>
              {codeError ?? '메일함을 확인하고 6자리 인증번호를 입력해주세요'}
            </Text>
          </View>
        ) : null}

        <Field
          label="비밀번호"
          placeholder="8자 이상"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPw}
          error={password.length > 0 && !passwordValid ? '비밀번호는 8자 이상이에요' : undefined}
          trailing={
            <Pressable onPress={() => setShowPw((v) => !v)} accessibilityRole="button">
              <Text style={[styles.toggle, { color: t.textMuted }]}>
                {showPw ? '숨김' : '보기'}
              </Text>
            </Pressable>
          }
        />

        <Field
          label="비밀번호 확인"
          placeholder="비밀번호를 다시 입력하세요"
          value={passwordConfirm}
          onChangeText={setPasswordConfirm}
          secureTextEntry={!showPw}
          error={
            passwordConfirm.length > 0 && !passwordMatch ? '비밀번호가 일치하지 않아요' : undefined
          }
          success={passwordMatch ? '비밀번호가 일치해요' : undefined}
        />
      </View>

      <View style={[styles.card, { backgroundColor: t.surface }]}>
        <Pressable
          onPress={() => toggleAll(!agreeAll)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreeAll }}
          style={[styles.agreeAll, { borderBottomColor: t.border }]}>
          <CheckBox checked={agreeAll} />
          <Text style={[styles.agreeAllText, { color: t.text }]}>전체 동의</Text>
        </Pressable>

        <AgreementItem
          checked={agreeTerms}
          required
          label="이용약관 동의"
          onChange={(v) => {
            setAgreeTerms(v);
            syncAgreeAll(v, agreePrivacy, agreeMarketing);
          }}
        />
        <AgreementItem
          checked={agreePrivacy}
          required
          label="개인정보 처리방침 동의"
          onChange={(v) => {
            setAgreePrivacy(v);
            syncAgreeAll(agreeTerms, v, agreeMarketing);
          }}
        />
        <AgreementItem
          checked={agreeMarketing}
          label="마케팅 정보 수신 동의"
          onChange={(v) => {
            setAgreeMarketing(v);
            syncAgreeAll(agreeTerms, agreePrivacy, v);
          }}
        />
      </View>

      {/* Signup API isn't available yet; keep the form as a preview but never
          submit (onSignupSuccess stays for when the backend lands). */}
      <Pressable
        onPress={() => toast('이메일 가입은 서버 준비 중이에요', 'error')}
        accessibilityRole="button"
        accessibilityState={{ disabled: true }}
        style={[styles.submit, { backgroundColor: t.disabledBg }]}>
        <Text style={[styles.submitText, { color: t.textMuted }]}>가입 준비 중</Text>
      </Pressable>

      <View style={styles.footer}>
        <Text style={[styles.msg, { color: t.textMuted }]}>이미 계정이 있으신가요? </Text>
        <Pressable onPress={onBack} accessibilityRole="button">
          <Text style={[styles.footerLink, { color: t.primaryText }]}>로그인</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CheckBox({ checked }: { checked: boolean }) {
  const t = useTokens();
  return (
    <View
      style={[
        styles.checkbox,
        checked
          ? { backgroundColor: t.primary, borderColor: t.primary }
          : { backgroundColor: t.surfaceMuted, borderColor: t.border },
      ]}>
      {checked ? <Icon name="check" size={14} color={t.onPrimary} /> : null}
    </View>
  );
}

type AgreementItemProps = {
  checked: boolean;
  label: string;
  required?: boolean;
  onChange: (v: boolean) => void;
};

function AgreementItem({ checked, label, required, onChange }: AgreementItemProps) {
  const t = useTokens();
  return (
    <View style={styles.agreeItem}>
      <Pressable
        onPress={() => onChange(!checked)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        style={styles.agreeItemMain}>
        <CheckBox checked={checked} />
        <Text style={[styles.agreeLabel, { color: t.text }]}>
          {label}{' '}
          <Text style={{ color: required ? t.danger : t.textMuted }}>
            ({required ? '필수' : '선택'})
          </Text>
        </Text>
      </Pressable>
      <Pressable accessibilityRole="button">
        <Text style={[styles.viewLink, { color: t.textMuted }]}>보기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingBottom: Spacing.five,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  intro: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.half,
  },
  notice: {
    marginHorizontal: Spacing.four,
    marginTop: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 18,
  },
  introTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  introTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  introSub: {
    fontSize: 14,
  },
  card: {
    marginHorizontal: Spacing.four,
    marginTop: Spacing.four,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.three,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  fieldWrap: {
    gap: Spacing.half,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: Spacing.one,
  },
  inlineRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  inputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: Spacing.half,
  },
  code: {
    letterSpacing: 4,
  },
  timer: {
    fontSize: 12,
    fontWeight: '600',
  },
  sideBtn: {
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  msg: {
    fontSize: 12,
    marginLeft: Spacing.one,
  },
  toggle: {
    fontSize: 12,
    fontWeight: '600',
  },
  agreeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  agreeAllText: {
    fontSize: 15,
    fontWeight: '600',
  },
  agreeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  agreeItemMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    flex: 1,
  },
  agreeLabel: {
    fontSize: 14,
  },
  viewLink: {
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submit: {
    marginHorizontal: Spacing.four,
    marginTop: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
    alignItems: 'center',
  },
  submitText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.four,
  },
  footerLink: {
    fontSize: 12,
    fontWeight: '600',
  },
});
