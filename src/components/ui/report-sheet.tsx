import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { ReportReason } from '@/api/types';
import { BottomSheet, SheetDragExclude } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { SheetHandle } from '@/components/ui/sheet-handle';
import { REPORT_DETAIL_MAX } from '@/constants/moderation';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

/** 서버 enum `ContentReportReason` 순서 그대로 — 기타는 맨 끝. */
export const REPORT_REASONS: readonly ReportReason[] = [
  'SPAM',
  'ABUSE',
  'SEXUAL',
  'VIOLENCE',
  'PERSONAL_INFO',
  'COPYRIGHT',
  'OTHER',
];

const RADIO_SIZE = 20;
const RADIO_DOT = 10;
const DETAIL_MIN_HEIGHT = 72;

export type ReportSheetProps = {
  visible: boolean;
  /** 무엇을 신고하는지 — 제목 아래 안내에 들어간다(예: '게시물', '댓글', '가구'). */
  targetLabel: string;
  /** 신고하기 — 사유는 필수, 설명은 앞뒤 공백을 뗀 뒤 비어 있으면 undefined. */
  onSubmit: (reason: ReportReason, detail?: string) => void;
  /** 백드롭·끌어내리기·안드로이드 뒤로. */
  onClose: () => void;
  /** 보내는 중 — 버튼을 잠그고 끌어내리기를 막는다. */
  submitting?: boolean;
};

/**
 * 콘텐츠 신고 시트 (#1428) — 사유 7종(서버 enum) 중 하나와 선택 설명(최대 500자).
 * 사유를 고르기 전에는 신고하기가 잠긴다. 열릴 때마다 입력을 비운다. 피드 게시물·댓글과
 * 거래소 가구가 같이 쓴다 — 무엇을 신고하는지는 `targetLabel`로만 달라진다.
 */
export function ReportSheet({
  visible,
  targetLabel,
  onSubmit,
  onClose,
  submitting = false,
}: ReportSheetProps) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState('');

  // 다시 열면 이전 입력을 남기지 않는다 — 다른 대상을 신고할 수 있다.
  useEffect(() => {
    if (!visible) return;
    setReason(null);
    setDetail('');
  }, [visible]);

  const canSubmit = reason !== null && !submitting;
  const submit = () => {
    if (!canSubmit) return;
    const trimmed = detail.trim();
    onSubmit(reason, trimmed ? trimmed : undefined);
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={submitting ? undefined : onClose}
      accessibilityLabel={tr('member.moderation.report.sheetA11y')}
      avoidKeyboard
      dragEnabled={!submitting}
      cardStyle={[styles.sheet, { backgroundColor: t.screen }]}>
      <SheetHandle />
      <Text style={[Typography.h3, { color: t.text }]}>{tr('member.moderation.report.title')}</Text>
      <Text style={[Typography.supporting, { color: t.textMuted }]}>
        {tr('member.moderation.report.subtitle', { target: targetLabel })}
      </Text>
      <SheetDragExclude>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollBody}
          showsVerticalScrollIndicator={false}>
          <View accessibilityRole="radiogroup" style={styles.reasons}>
            {REPORT_REASONS.map((r) => {
              const selected = reason === r;
              const label = tr(`member.moderation.reason.${r}`);
              return (
                <Pressable
                  key={r}
                  onPress={() => setReason(r)}
                  disabled={submitting}
                  accessibilityRole="radio"
                  accessibilityLabel={label}
                  accessibilityState={{ checked: selected, disabled: submitting }}
                  // RN Web은 accessibilityState를 DOM으로 옮기지 않는다(bear-check와 같은 이유).
                  aria-checked={selected}
                  style={[
                    styles.reasonRow,
                    { backgroundColor: selected ? t.primarySoft : t.surfaceMuted },
                  ]}>
                  <View style={[styles.radio, { borderColor: selected ? t.primary : t.textMuted }]}>
                    {selected ? (
                      <View style={[styles.radioDot, { backgroundColor: t.primary }]} />
                    ) : null}
                  </View>
                  <Text style={[Typography.body, { color: selected ? t.primaryText : t.text }]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={detail}
            onChangeText={(v) => setDetail(v.slice(0, REPORT_DETAIL_MAX))}
            maxLength={REPORT_DETAIL_MAX}
            multiline
            editable={!submitting}
            placeholder={tr('member.moderation.report.detailPlaceholder')}
            placeholderTextColor={t.textMuted}
            accessibilityLabel={tr('member.moderation.report.detailA11y')}
            style={[
              Typography.body,
              styles.detail,
              { backgroundColor: t.surfaceMuted, color: t.text },
            ]}
          />
          <Text style={[Typography.supporting, styles.counter, { color: t.textMuted }]}>
            {tr('member.moderation.report.counter', {
              count: detail.length,
              max: REPORT_DETAIL_MAX,
            })}
          </Text>
          <Text style={[Typography.supporting, { color: t.textMuted }]}>
            {tr('member.moderation.report.notice')}
          </Text>
        </ScrollView>
      </SheetDragExclude>
      <Button
        label={
          submitting
            ? tr('member.moderation.report.submitting')
            : tr('member.moderation.report.submit')
        }
        accessibilityLabel={tr('member.moderation.report.submit')}
        variant="danger"
        disabled={!canSubmit}
        onPress={submit}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    maxHeight: '90%',
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  scrollBody: {
    gap: Spacing.two,
  },
  reasons: {
    gap: Spacing.one,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.md,
  },
  radio: {
    width: RADIO_SIZE,
    height: RADIO_SIZE,
    borderRadius: RADIO_SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: RADIO_DOT,
    height: RADIO_DOT,
    borderRadius: RADIO_DOT / 2,
  },
  detail: {
    minHeight: DETAIL_MIN_HEIGHT,
    maxHeight: 140,
    marginTop: Spacing.two,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    textAlignVertical: 'top',
  },
  counter: {
    alignSelf: 'flex-end',
  },
});
