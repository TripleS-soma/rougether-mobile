import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { GlassSurface } from '@/components/ui/glass-surface';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import type { AppUpdateState, AppUpdateStatus } from '@/types/app-update';

const COPY: Record<AppUpdateStatus, { title: string; body: string; action: string }> = {
  idle: {
    title: '앱 업데이트',
    body: '새로운 기능과 개선 사항을 확인해요.',
    action: '업데이트 확인',
  },
  checking: {
    title: '업데이트 확인 중',
    body: '이 앱에서 받을 수 있는 업데이트를 찾고 있어요.',
    action: '확인 중',
  },
  downloading: {
    title: '업데이트 다운로드 중',
    body: '완료되면 원하는 때에 적용할 수 있어요.',
    action: '다운로드 중',
  },
  ready: {
    title: '업데이트 준비 완료',
    body: '앱을 다시 시작하면 새 업데이트가 적용돼요.',
    action: '지금 적용',
  },
  applying: { title: '업데이트 적용 중', body: '잠시 후 앱이 다시 시작돼요.', action: '적용 중' },
  'no-update': {
    title: '업데이트 확인 완료',
    body: '현재 앱과 호환되는 새 업데이트가 없어요. 스토어의 앱 업데이트는 별도로 확인해 주세요.',
    action: '다시 확인',
  },
  error: {
    title: '업데이트를 완료하지 못했어요',
    body: '현재 버전은 계속 사용할 수 있어요.',
    action: '다시 시도',
  },
  unsupported: {
    title: '앱 업데이트',
    body: '이 실행 환경에서는 앱 안에서 업데이트할 수 없어요. 스토어 설치 앱에서 확인해 주세요.',
    action: '이 환경에서는 지원 안 함',
  },
};

export type AppUpdateCardProps = {
  state: AppUpdateState;
  onCheck?: () => void;
  onApply?: () => void;
};

/** Prop-only OTA controls. Opening a confirmation never changes the running app. */
export function AppUpdateCard({ state, onCheck, onApply }: AppUpdateCardProps) {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const [confirm, setConfirm] = useState(false);
  const [details, setDetails] = useState(false);
  const copy = COPY[state.status];
  const busy = ['checking', 'downloading', 'applying'].includes(state.status);
  const ready = state.status === 'ready';
  const disabled = busy || state.status === 'unsupported' || !(ready ? onApply : onCheck);
  const showProgress = state.status === 'downloading' && state.progress !== undefined;
  return (
    <GlassSurface
      fallbackColor={t.surface}
      interactive={false}
      style={styles.card}
      testID="app-update-card">
      <View style={styles.heading}>
        <View style={[styles.icon, { backgroundColor: t.primarySoft }]}>
          <Icon name={ready ? 'check' : 'refresh'} size={Spacing.four} color={t.primaryText} />
        </View>
        <View style={styles.flex}>
          <Text style={[Typography.label, emph('semibold'), { color: t.text }]}>{copy.title}</Text>
          <Text style={[Typography.supporting, { color: t.textMuted }]}>
            버전 {state.info.appVersion}
          </Text>
        </View>
      </View>
      <Text
        accessibilityLiveRegion="polite"
        style={[Typography.supporting, { color: t.textMuted }]}>
        {copy.body}
        {showProgress ? ` ${Math.round(state.progress! * 100)}%` : ''}
      </Text>
      {state.error ? (
        <Text accessibilityRole="alert" style={[Typography.supporting, { color: t.dangerText }]}>
          {state.error}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.action}
        accessibilityState={{ disabled, busy }}
        aria-busy={busy}
        disabled={disabled}
        onPress={ready ? () => setConfirm(true) : onCheck}>
        <GlassSurface
          fallbackColor={disabled ? t.surfaceMuted : t.primary}
          tintColor={disabled ? t.surfaceMuted : t.primary}
          interactive={!disabled}
          style={styles.action}>
          {busy ? <ActivityIndicator size="small" color={t.textMuted} /> : null}
          <Text style={[Typography.label, { color: disabled ? t.textMuted : t.onPrimary }]}>
            {copy.action}
          </Text>
        </GlassSurface>
      </Pressable>
      <Pressable
        onPress={() => setDetails((value) => !value)}
        accessibilityRole="button"
        accessibilityLabel="업데이트 정보"
        accessibilityState={{ expanded: details }}
        aria-expanded={details}
        style={styles.detailsButton}>
        <Text style={[Typography.supporting, { color: t.textMuted }]}>업데이트 정보</Text>
        <View style={details ? styles.chevronOpen : styles.chevronClosed}>
          <Icon name="forward" size={Spacing.three} color={t.textMuted} />
        </View>
      </Pressable>
      {details ? (
        <View style={[styles.details, { borderTopColor: t.border }]}>
          {[
            ['채널', state.info.channel ?? '확인 불가'],
            ['런타임', state.info.runtimeVersion ?? '확인 불가'],
            ['실행 중 업데이트', state.info.updateId ?? '확인 불가'],
            ['실행 코드', state.info.embedded ? '앱에 포함된 기본 코드' : '다운로드한 업데이트'],
          ].map(([label, value]) => (
            <View key={label} style={styles.detailRow}>
              <Text style={[Typography.supporting, { color: t.textMuted }]}>{label}</Text>
              <Text selectable style={[Typography.supporting, { color: t.text }]}>
                {value}
              </Text>
            </View>
          ))}
          {state.info.emergencyLaunch ? (
            <Text style={[Typography.supporting, { color: t.warningText }]}>
              이전 업데이트를 실행하지 못해 기본 코드로 복구했어요.
            </Text>
          ) : null}
        </View>
      ) : null}
      <ConfirmDialog
        visible={confirm && ready}
        title="업데이트를 지금 적용할까요?"
        body="앱이 다시 시작돼요. 저장하지 않은 작업이 있다면 먼저 저장해 주세요."
        confirmLabel="지금 적용"
        confirmAccessibilityLabel="업데이트 적용 확인"
        cancelLabel="나중에"
        onConfirm={() => {
          setConfirm(false);
          onApply?.();
        }}
        onCancel={() => setConfirm(false)}
      />
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.xl, padding: Spacing.three, gap: Spacing.three },
  heading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  icon: {
    width: Spacing.four * 2,
    height: Spacing.four * 2,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, gap: Spacing.one },
  action: {
    borderRadius: Radius.pill,
    padding: Spacing.three,
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
  details: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  detailRow: { gap: Spacing.one },
  chevronOpen: { transform: [{ rotate: '-90deg' }] },
  chevronClosed: { transform: [{ rotate: '90deg' }] },
});
