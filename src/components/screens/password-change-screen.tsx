import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Field } from '@/components/ui/field';
import { ActionBar } from '@/components/ui/action-bar';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Radius, Spacing } from '@/constants/theme';
import { useActionBarInset, useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

const MIN_LENGTH = 8;

export type PasswordChangeScreenProps = {
  /** Reserved for when the backend gains password auth (submit is disabled). */
  onSubmit?: (current: string, next: string) => void;
  onBack?: () => void;
};

/**
 * "비밀번호 변경" screen. 지금은 **앱에서 도달할 수 없다** (#787) — 서버 인증이
 * 소셜·dev 로그인뿐이라 비밀번호 계정이 없어 설정 진입점을 내렸다. 서버가
 * 비밀번호 인증을 붙이면 설정 행과 셸 배선만 되살리면 되도록 화면·테스트·Dev
 * 갤러리 엔트리는 남겨 둔다. 새 비밀번호의 길이·일치는 로컬에서 검증하고,
 * 실제 변경 요청은 셸이 onSubmit으로 처리한다.
 */
export function PasswordChangeScreen({ onBack }: PasswordChangeScreenProps) {
  const t = useTokens();
  const tr = useT();
  const column = useResponsiveColumn();
  // 떠 있는 글래스 헤더(#1069) 밑으로 콘텐츠가 지나가도록 상단 패딩.
  const headerInset = useHeaderContentInset();
  const actionBarInset = useActionBarInset();
  const Typography = useTypography();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  const tooShort = next.length > 0 && next.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== next;

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <ScreenHeader title={tr('app.passwordChange.title')} onBack={onBack} />

      <ScrollView
        contentContainerStyle={[
          styles.body,
          column,
          headerInset ? { paddingTop: headerInset } : null,
          actionBarInset ? { paddingBottom: actionBarInset } : null,
        ]}>
        {/* The dev API has no password auth yet — be honest instead of a fake
            success that just navigates back. */}
        <View style={[styles.notice, { backgroundColor: t.warningSoft, borderColor: t.warning }]}>
          <Text style={[Typography.supporting, styles.noticeText, { color: t.text }]}>
            비밀번호 변경은 준비 중이에요. 지금 계정은 개발 로그인이라 비밀번호가 없어요.
          </Text>
        </View>
        <Field
          label={tr('app.passwordChange.current')}
          value={current}
          onChangeText={setCurrent}
          placeholder={tr('app.passwordChange.current')}
          secureTextEntry
          autoCapitalize="none"
        />
        <Field
          label={tr('app.passwordChange.new')}
          value={next}
          onChangeText={setNext}
          placeholder={tr('app.passwordChange.newPlaceholder', { min: MIN_LENGTH })}
          secureTextEntry
          autoCapitalize="none"
          error={
            tooShort
              ? tr('app.passwordChange.tooShort', { min: MIN_LENGTH })
              : next.length >= MIN_LENGTH && next === current
                ? tr('app.passwordChange.sameAsCurrent')
                : undefined
          }
        />
        <Field
          label={tr('app.passwordChange.confirm')}
          value={confirm}
          onChangeText={setConfirm}
          placeholder={tr('app.passwordChange.confirmPlaceholder')}
          secureTextEntry
          autoCapitalize="none"
          error={mismatch ? tr('app.passwordChange.mismatch') : undefined}
          success={confirm.length > 0 && !mismatch ? tr('app.passwordChange.match') : undefined}
        />
      </ScrollView>

      <ActionBar>
        {/* onSubmit is reserved for when a password API exists; disabled until then. */}
        <Pressable
          disabled
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          accessibilityLabel={tr('app.passwordChange.title')}
          style={styles.submit}>
          <GlassSurface style={styles.submitFace} fallbackColor={t.surfaceMuted}>
            <Text style={[Typography.label, { color: t.textMuted }]}>
              {tr('app.passwordChange.pending')}
            </Text>
          </GlassSurface>
        </Pressable>
      </ActionBar>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  body: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  notice: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  noticeText: {
    lineHeight: 20,
  },
  footer: {
    padding: Spacing.four,
    borderTopWidth: 1,
  },
  submit: {
    borderRadius: Radius.pill,
  },
  submitFace: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
});
