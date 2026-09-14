import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Field } from '@/components/ui/field';
import { type PolicyDoc } from '@/constants/policy';
import { Icon } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { PawPictogram } from '@/components/ui/pictograms';
import { Radius, ShadowColor, Spacing } from '@/constants/theme';
import { useToast } from '@/components/ui/toast';
import { useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

export type SignupScreenProps = {
  onBack?: () => void;
  /** Reserved for when the backend gains a signup endpoint (submit is disabled). */
  onSignupSuccess?: () => void;
  /** Opens the given policy document (약관/처리방침 '보기'); rows hide the link when omitted. */
  onViewPolicy?: (doc: PolicyDoc) => void;
};

/**
 * Signup screen, ported from the prototype `SignupScreen`. Shares `Field` with
 * the login screen; email + verification-code rows are custom (inline side
 * button) like the original. Icons are text placeholders for now.
 */
export function SignupScreen({ onBack, onViewPolicy }: SignupScreenProps) {
  const t = useTokens();
  const tr = useT();
  const column = useResponsiveColumn();
  const emph = useFontEmphasis();
  const Typography = useTypography();
  // 떠 있는 글래스 헤더(#1069) 밑으로 콘텐츠가 지나가도록 상단 패딩.
  const headerInset = useHeaderContentInset();
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
      ? tr('member.signup.nicknameLength')
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
    if (!emailValid) return toast(tr('member.signup.emailInvalidToast'), 'error');
    if (secondsLeft > 150) return toast(tr('member.signup.retryLater'), 'error');
    setCodeSent(true);
    setSecondsLeft(180);
    setVerificationCode('');
    setCodeError(null);
  };

  const handleVerifyCode = () => {
    if (verificationCode.length !== 6) {
      setCodeError(tr('member.signup.codeLength'));
      return;
    }
    if (secondsLeft <= 0) {
      setCodeError(tr('member.signup.codeExpired'));
      return;
    }
    setEmailVerified(true);
    setCodeError(null);
  };

  const sendDisabled = !emailValid || emailVerified || secondsLeft > 150;

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <ScreenHeader title={tr('member.signup.title')} onBack={onBack} />

      {/* 스크롤 컨테이너가 없어 블록마다 묶는다. 헤더는 풀폭 유지 (#725). */}
      <View style={[styles.intro, column, headerInset ? { paddingTop: headerInset } : null]}>
        <View style={styles.introTitleRow}>
          <Text style={[Typography.h2, { color: t.text }]}>{tr('member.signup.welcome')}</Text>
          <PawPictogram size={18} />
        </View>
        <Text style={[styles.introSub, emph('normal'), { color: t.textMuted }]}>
          {tr('member.signup.intro')}
        </Text>
      </View>

      {/* The backend has no signup endpoint yet — be honest instead of a fake
          flow that bounces back to login. */}
      <View
        style={[styles.notice, column, { backgroundColor: t.warningSoft, borderColor: t.warning }]}>
        <Text style={[Typography.supporting, styles.noticeText, { color: t.text }]}>
          {tr('member.signup.notice')}
        </Text>
      </View>

      <View style={[styles.card, column, { backgroundColor: t.surface }]}>
        <Field
          label={tr('member.common.nickname')}
          placeholder={tr('member.signup.nicknamePlaceholder')}
          value={nickname}
          onChangeText={setNickname}
          error={nicknameError}
        />

        {/* Email + verification request (custom inline row) */}
        <View style={styles.fieldWrap}>
          <Text
            style={[Typography.supporting, emph('semibold'), styles.label, { color: t.textMuted }]}>
            {tr('member.signup.email')}
          </Text>
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
                style={[
                  styles.input,
                  emph('normal'),
                  { color: emailVerified ? t.textMuted : t.text },
                ]}
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
              <Text style={[Typography.label, { color: sendDisabled ? t.textMuted : t.onPrimary }]}>
                {emailVerified
                  ? tr('member.signup.verified')
                  : codeSent
                    ? tr('member.signup.resend')
                    : tr('member.signup.requestCode')}
              </Text>
            </Pressable>
          </View>
          {email.length > 0 && !emailValid ? (
            <Text style={[Typography.supporting, styles.msg, { color: t.danger }]}>
              {tr('member.signup.emailInvalid')}
            </Text>
          ) : null}
          {emailVerified ? (
            <Text style={[Typography.supporting, styles.msg, { color: t.primaryText }]}>
              {tr('member.signup.emailVerified')}
            </Text>
          ) : null}
        </View>

        {/* Verification code (custom inline row) */}
        {codeSent && !emailVerified ? (
          <View style={styles.fieldWrap}>
            <Text
              style={[
                Typography.supporting,
                emph('semibold'),
                styles.label,
                { color: t.textMuted },
              ]}>
              {tr('member.signup.code')}
            </Text>
            <View style={styles.inlineRow}>
              <View
                style={[
                  styles.inputBox,
                  { backgroundColor: t.surfaceMuted },
                  { borderColor: codeError ? t.danger : 'transparent' },
                ]}>
                <TextInput
                  // iOS placeholder 자간 이슈 — 값 있을 때만 자간.
                  style={[
                    styles.input,
                    emph('normal'),
                    verificationCode.length > 0 && styles.code,
                    { color: t.text },
                  ]}
                  value={verificationCode}
                  onChangeText={(v) => setVerificationCode(v.replace(/\D/g, '').slice(0, 6))}
                  placeholder={tr('member.signup.codePlaceholder')}
                  placeholderTextColor={t.textMuted}
                  keyboardType="number-pad"
                  maxLength={6}
                />
                {secondsLeft > 0 ? (
                  <Text style={[Typography.supporting, emph('semibold'), { color: t.warningText }]}>
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
                    Typography.label,
                    { color: verificationCode.length !== 6 ? t.textMuted : t.onPrimary },
                  ]}>
                  {tr('common.confirm')}
                </Text>
              </Pressable>
            </View>
            <Text
              style={[
                Typography.supporting,
                styles.msg,
                { color: codeError ? t.danger : t.textMuted },
              ]}>
              {codeError ?? tr('member.signup.codeHint')}
            </Text>
          </View>
        ) : null}

        <Field
          label={tr('member.signup.password')}
          placeholder={tr('member.signup.passwordPlaceholder')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPw}
          error={
            password.length > 0 && !passwordValid ? tr('member.signup.passwordTooShort') : undefined
          }
          trailing={
            <Pressable onPress={() => setShowPw((v) => !v)} accessibilityRole="button">
              <Text style={[Typography.supporting, emph('semibold'), { color: t.textMuted }]}>
                {showPw ? tr('member.common.hide') : tr('member.common.show')}
              </Text>
            </Pressable>
          }
        />

        <Field
          label={tr('member.signup.passwordConfirm')}
          placeholder={tr('member.signup.passwordConfirmPlaceholder')}
          value={passwordConfirm}
          onChangeText={setPasswordConfirm}
          secureTextEntry={!showPw}
          error={
            passwordConfirm.length > 0 && !passwordMatch
              ? tr('member.signup.passwordMismatch')
              : undefined
          }
          success={passwordMatch ? tr('member.signup.passwordMatch') : undefined}
        />
      </View>

      <View style={[styles.card, column, { backgroundColor: t.surface }]}>
        <Pressable
          onPress={() => toggleAll(!agreeAll)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreeAll }}
          style={[styles.agreeAll, { borderBottomColor: t.border }]}>
          <CheckBox checked={agreeAll} />
          <Text style={[styles.agreeAllText, emph('semibold'), { color: t.text }]}>
            {tr('member.signup.agreeAll')}
          </Text>
        </Pressable>

        <AgreementItem
          checked={agreeTerms}
          required
          label={tr('member.signup.agreeTerms')}
          onView={onViewPolicy && (() => onViewPolicy('terms'))}
          onChange={(v) => {
            setAgreeTerms(v);
            syncAgreeAll(v, agreePrivacy, agreeMarketing);
          }}
        />
        <AgreementItem
          checked={agreePrivacy}
          required
          label={tr('member.signup.agreePrivacy')}
          onView={onViewPolicy && (() => onViewPolicy('privacy'))}
          onChange={(v) => {
            setAgreePrivacy(v);
            syncAgreeAll(agreeTerms, v, agreeMarketing);
          }}
        />
        {/* Marketing consent has no standalone document yet — no '보기' link. */}
        <AgreementItem
          checked={agreeMarketing}
          label={tr('member.signup.agreeMarketing')}
          onChange={(v) => {
            setAgreeMarketing(v);
            syncAgreeAll(agreeTerms, agreePrivacy, v);
          }}
        />
      </View>

      {/* Signup API isn't available yet; keep the form as a preview but never
          submit (onSignupSuccess stays for when the backend lands). */}
      <Pressable
        onPress={() => toast(tr('member.signup.submitNotReady'), 'error')}
        accessibilityRole="button"
        accessibilityState={{ disabled: true }}
        style={[styles.submit, { backgroundColor: t.disabledBg }]}>
        <Text style={[Typography.body, emph('semibold'), { color: t.textMuted }]}>
          {tr('member.signup.submitLabel')}
        </Text>
      </Pressable>

      <View style={[styles.footer, column]}>
        <Text style={[Typography.supporting, styles.msg, { color: t.textMuted }]}>
          {tr('member.signup.haveAccount')}{' '}
        </Text>
        <Pressable onPress={onBack} accessibilityRole="button">
          <Text style={[Typography.supporting, emph('semibold'), { color: t.primaryText }]}>
            {tr('member.signup.login')}
          </Text>
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
  /** Opens the linked document; the '보기' link renders only when provided. */
  onView?: () => void;
};

function AgreementItem({ checked, label, required, onChange, onView }: AgreementItemProps) {
  const t = useTokens();
  const tr = useT();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  return (
    <View style={styles.agreeItem}>
      <Pressable
        onPress={() => onChange(!checked)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        style={styles.agreeItemMain}>
        <CheckBox checked={checked} />
        <Text style={[styles.agreeLabel, emph('normal'), { color: t.text }]}>
          {label}{' '}
          <Text style={{ color: required ? t.danger : t.textMuted }}>
            ({required ? tr('member.signup.required') : tr('member.signup.optional')})
          </Text>
        </Text>
      </Pressable>
      {onView ? (
        <Pressable
          onPress={onView}
          accessibilityRole="button"
          accessibilityLabel={tr('member.signup.viewDocA11y', { label })}>
          <Text style={[Typography.supporting, styles.viewLink, { color: t.textMuted }]}>
            {tr('member.common.show')}
          </Text>
        </Pressable>
      ) : null}
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
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
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
    lineHeight: 20,
  },
  introTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  introSub: {
    fontSize: 16,
  },
  card: {
    marginHorizontal: Spacing.four,
    marginTop: Spacing.four,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.three,
    shadowColor: ShadowColor,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  fieldWrap: {
    gap: Spacing.half,
  },
  label: {
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
    fontSize: 16,
    paddingVertical: Spacing.half,
  },
  code: {
    letterSpacing: 4,
  },
  sideBtn: {
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msg: {
    marginLeft: Spacing.one,
  },
  agreeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  agreeAllText: {
    fontSize: 17,
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
    fontSize: 16,
  },
  viewLink: {
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.four,
  },
});
