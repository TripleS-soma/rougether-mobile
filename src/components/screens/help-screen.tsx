import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Radius, Spacing } from '@/constants/theme';
import { useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

/**
 * 도움말 FAQ — **앱에 실제로 있는 것만** 적는다. "인증 사진형 루틴" 항목이
 * 있었지만 루틴 만들기에 사진 인증 토글이 없고(서버 루틴도 verificationType이
 * 전부 null) 카메라는 버그 제보 스크린샷에서만 쓴다 — 없는 기능을 하라고
 * 안내하던 셈이라 지웠다 (#797). 서버·UI가 생기면 그때 되살릴 것.
 */
const FAQ_IDS = ['addRoutine', 'currency', 'friends'] as const;

export type HelpScreenProps = {
  appVersion?: string;
  onContact?: () => void;
  onBack?: () => void;
};

/**
 * "도움말" screen reached from 설정 → 도움말. A small FAQ accordion plus a
 * contact row and the app version. Pure/prop-driven.
 */
export function HelpScreen({ appVersion = '1.0.0', onContact, onBack }: HelpScreenProps) {
  const t = useTokens();
  const column = useResponsiveColumn();
  // 떠 있는 글래스 헤더(#1069) 밑으로 콘텐츠가 지나가도록 상단 패딩.
  const headerInset = useHeaderContentInset();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const tr = useT();
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const faqs = FAQ_IDS.map((id) => ({
    id,
    q: tr(`member.help.faq.${id}.q`),
    a: tr(`member.help.faq.${id}.a`),
  }));

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <ScreenHeader title={tr('member.help.title')} onBack={onBack} />

      <ScrollView
        contentContainerStyle={[
          styles.body,
          column,
          headerInset ? { paddingTop: headerInset } : null,
        ]}>
        <Text
          style={[
            Typography.supporting,
            emph('semibold'),
            styles.sectionTitle,
            { color: t.textMuted },
          ]}>
          {tr('member.help.faqTitle')}
        </Text>
        <View style={[styles.card, { backgroundColor: t.surface }]}>
          {faqs.map((faq, idx) => {
            const open = openIdx === idx;
            return (
              <View
                key={faq.id}
                style={
                  idx !== faqs.length - 1 && {
                    borderBottomColor: t.border,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                  }
                }>
                <Pressable
                  onPress={() => setOpenIdx(open ? null : idx)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  accessibilityLabel={faq.q}
                  style={styles.qRow}>
                  <Text style={[Typography.body, styles.flex, { color: t.text }]}>{faq.q}</Text>
                  <View style={open ? styles.chevronOpen : undefined}>
                    <Icon name="forward" size={16} color={t.textMuted} />
                  </View>
                </Pressable>
                {open ? (
                  <Text style={[Typography.supporting, styles.answer, { color: t.textMuted }]}>
                    {faq.a}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>

        <Text
          style={[
            Typography.supporting,
            emph('semibold'),
            styles.sectionTitle,
            { color: t.textMuted },
          ]}>
          {tr('member.help.support')}
        </Text>
        <View style={[styles.card, { backgroundColor: t.surface }]}>
          <Pressable
            onPress={onContact}
            accessibilityRole="button"
            accessibilityLabel={tr('member.help.contact')}
            style={styles.linkRow}>
            <Text style={[Typography.body, { color: t.text }]}>{tr('member.help.contact')}</Text>
            <Icon name="forward" size={16} color={t.textDisabled} />
          </Pressable>
        </View>

        <Text style={[Typography.supporting, styles.version, { color: t.textMuted }]}>
          {tr('member.help.version', { version: appVersion })}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  body: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  sectionTitle: {
    paddingHorizontal: Spacing.two,
    marginTop: Spacing.two,
  },
  card: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  qRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  chevronOpen: {
    transform: [{ rotate: '90deg' }],
  },
  answer: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  version: {
    textAlign: 'center',
    marginTop: Spacing.three,
  },
});
