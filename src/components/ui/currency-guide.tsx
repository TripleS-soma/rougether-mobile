import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { CURRENCY_GUIDES } from '@/constants/currency';
import { Radius, Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';

export type CurrencyGuideProps = {
  /** 펼친 채로 시작 — Dev 갤러리·테스트용. 실사용은 접힘이 기본. */
  initialOpen?: boolean;
};

/**
 * 재화 안내 (#789) — "코인·다이아는 어떻게 모으고 쓰나요?" 접이식 블록.
 * 재화 내역 시트(#734) 맨 위에 붙어, 내역을 보러 온 사람을 막지 않도록 기본은
 * 접혀 있다. 문구·수치는 `CURRENCY_GUIDES` 한곳에서 온다.
 *
 * 두 재화를 늘 함께 보여준다 — 코인으로 뽑고 → 중복이 다이아가 되고 → 다이아로
 * 가구를 사는 흐름이라, 한쪽만 떼면 경제가 이해되지 않는다.
 */
export function CurrencyGuide({ initialOpen = false }: CurrencyGuideProps) {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const [open, setOpen] = useState(initialOpen);

  return (
    <View style={[styles.card, { backgroundColor: t.surface }]}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel="코인·다이아는 어떻게 모으나요?"
        style={styles.head}>
        <Icon name="help" size={16} color={t.textMuted} />
        <Text style={[Typography.body, styles.flex, { color: t.text }]}>
          코인·다이아는 어떻게 모으나요?
        </Text>
        <View style={open ? styles.chevronOpen : undefined}>
          <Icon name="forward" size={16} color={t.textMuted} />
        </View>
      </Pressable>

      {open ? (
        <View style={styles.body}>
          {CURRENCY_GUIDES.map((guide) => (
            <View key={guide.currency} style={styles.block}>
              <View style={styles.blockHead}>
                <Icon
                  name={guide.currency === 'diamond' ? 'diamond' : 'coin'}
                  size={14}
                  color={guide.currency === 'diamond' ? t.primary : t.warning}
                />
                <Text style={[Typography.label, emph('semibold'), { color: t.text }]}>
                  {guide.name}
                </Text>
              </View>

              {(
                [
                  ['모으기', guide.earn],
                  ['쓰기', guide.spend],
                ] as const
              ).map(([title, items]) => (
                <View key={title} style={styles.group}>
                  <Text style={[Typography.supporting, { color: t.textMuted }]}>{title}</Text>
                  {items.map((item) => (
                    <View key={item.label} style={styles.item}>
                      <Text style={[Typography.supporting, styles.flex, { color: t.text }]}>
                        {item.label}
                      </Text>
                      {item.detail ? (
                        <Text style={[Typography.supporting, { color: t.textMuted }]}>
                          {item.detail}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  // 닫힘 ▸ → 열림 ▾ (도움말 FAQ와 같은 회전 표현).
  chevronOpen: {
    transform: [{ rotate: '90deg' }],
  },
  body: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
  block: {
    gap: Spacing.one,
  },
  blockHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  group: {
    gap: Spacing.half,
    paddingLeft: Spacing.three,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
