import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Radius, Spacing } from '@/constants/theme';
import { useScreenStyle } from '@/hooks/use-screen-style';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';

/**
 * 도움말 FAQ — **앱에 실제로 있는 것만** 적는다. "인증 사진형 루틴" 항목이
 * 있었지만 루틴 만들기에 사진 인증 토글이 없고(서버 루틴도 verificationType이
 * 전부 null) 카메라는 버그 제보 스크린샷에서만 쓴다 — 없는 기능을 하라고
 * 안내하던 셈이라 지웠다 (#797). 서버·UI가 생기면 그때 되살릴 것.
 */
const FAQS: { q: string; a: string }[] = [
  {
    q: '루틴은 어떻게 추가하나요?',
    a: '나의 방 화면에서 카테고리의 + 버튼을 누르거나, 루틴 관리 화면에서 루틴을 추가할 수 있어요.',
  },
  {
    q: '코인과 다이아는 어떻게 모으나요?',
    a: '매일 루틴을 완료하면 코인을 받아요. 코인으로 뽑기를 하고, 뽑기에서 이미 가진 아이템이 나오면 다이아로 바뀌어요. 다이아로는 방 꾸미기에서 가구를 살 수 있어요.',
  },
  {
    q: '친구와 함께하려면 어떻게 하나요?',
    a: '집 탭에서 새 집을 만들거나 친구의 집에 참여해 함께 루틴을 이어갈 수 있어요.',
  },
];

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
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <ScreenHeader title="도움말" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.body}>
        <Text
          style={[
            Typography.supporting,
            emph('semibold'),
            styles.sectionTitle,
            { color: t.textMuted },
          ]}>
          자주 묻는 질문
        </Text>
        <View style={[styles.card, { backgroundColor: t.surface }]}>
          {FAQS.map((faq, idx) => {
            const open = openIdx === idx;
            return (
              <View
                key={faq.q}
                style={
                  idx !== FAQS.length - 1 && {
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
          지원
        </Text>
        <View style={[styles.card, { backgroundColor: t.surface }]}>
          <Pressable
            onPress={onContact}
            accessibilityRole="button"
            accessibilityLabel="문의하기"
            style={styles.linkRow}>
            <Text style={[Typography.body, { color: t.text }]}>문의하기</Text>
            <Icon name="forward" size={16} color={t.textDisabled} />
          </Pressable>
        </View>

        <Text style={[Typography.supporting, styles.version, { color: t.textMuted }]}>
          버전 {appVersion}
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
