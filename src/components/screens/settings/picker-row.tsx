import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';

export type PickerRowProps = {
  /** 견본 슬롯 — 테마는 색 원, 폰트는 글자 타일. 행의 나머지는 공유한다. */
  swatch: ReactNode;
  name: string;
  selected: boolean;
  /** 종류까지 읽어주는 라벨 ("포근 테마" / "SUIT 폰트") — 테스트도 이걸로 잡는다. */
  accessibilityLabel: string;
  onPress?: () => void;
};

/**
 * 테마 색상·폰트 피커 공용 선택 행 (#459 → #750에서 공유로 분리). 선택되면
 * 테두리가 두꺼워지고 이름이 굵어지며 오른쪽에 체크가 붙는다 — 색·굵기·체크
 * 세 신호를 겹쳐 색각 이상이나 저대비 환경에서도 구분된다.
 */
export function PickerRow({ swatch, name, selected, accessibilityLabel, onPress }: PickerRowProps) {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.row,
        { backgroundColor: t.surface, borderColor: selected ? t.primary : t.border },
        selected && styles.rowSelected,
      ]}>
      {swatch}
      <Text
        style={[
          Typography.body,
          emph(selected ? 'bold' : 'normal'),
          styles.name,
          { color: t.text },
        ]}>
        {name}
      </Text>
      {selected ? <Icon name="check" size={20} color={t.primaryText} /> : null}
    </Pressable>
  );
}

/** 피커 화면 공통 레이아웃 — 헤더 아래 미리보기 + 행 목록의 여백. */
export const pickerStyles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  body: {
    padding: Spacing.three,
    gap: Spacing.four,
  },
  list: {
    gap: Spacing.two,
  },
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  rowSelected: {
    borderWidth: 2,
  },
  name: {
    flex: 1,
  },
});
