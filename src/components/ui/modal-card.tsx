import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Overlay, Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

export type ModalCardAction = {
  label: string;
  /** 버튼 캡션과 다른 읽기 이름이 필요할 때 (예: '미션 만들기 취소'). */
  accessibilityLabel?: string;
  onPress: () => void;
  /** 확정 버튼만 — 꺼지면 회색으로 보인다. 그래도 `onPress`는 불린다: 막힌 이유를 호출부가 토스트로 알린다. */
  disabled?: boolean;
};

export type ModalCardProps = {
  title: string;
  /** 본문 — 폼·목록 등 무엇이든. 길면 호출부가 ScrollView로 감싼다. */
  children?: ReactNode;
  cancel: ModalCardAction;
  confirm: ModalCardAction;
};

/**
 * 폼을 담는 화면 위 모달 카드 (장부 7번) — 어둡게 덮은 바탕 위 가운데 카드, 제목·본문·
 * [취소 | 확정] 두 버튼. 본문이 문자열뿐이면 `ConfirmDialog`를 쓴다(그쪽은 RN `Modal`이라
 * 앱 전체를 덮고, 이쪽은 **화면 안에** 겹쳐 하단 바·시트와의 겹을 화면이 정한다).
 *
 * 열고 닫기는 호출부가 조건부 렌더로 한다(`{open ? <ModalCard … /> : null}`).
 */
export function ModalCard({ title, children, cancel, confirm }: ModalCardProps) {
  const t = useTokens();
  const Typography = useTypography();
  const confirmOff = confirm.disabled === true;
  return (
    <View style={styles.overlay}>
      <View style={[styles.card, { backgroundColor: t.surface }]}>
        <Text style={[Typography.h3, { color: t.text }]}>{title}</Text>
        {children}
        <View style={styles.actions}>
          <Pressable
            onPress={cancel.onPress}
            accessibilityRole="button"
            accessibilityLabel={cancel.accessibilityLabel ?? cancel.label}
            style={[styles.btn, { backgroundColor: t.surfaceMuted }]}>
            <Text style={[Typography.label, { color: t.text }]}>{cancel.label}</Text>
          </Pressable>
          <Pressable
            onPress={confirm.onPress}
            accessibilityRole="button"
            accessibilityState={{ disabled: confirmOff }}
            accessibilityLabel={confirm.accessibilityLabel ?? confirm.label}
            style={[styles.btn, { backgroundColor: confirmOff ? t.disabledBg : t.primary }]}>
            <Text style={[Typography.label, { color: confirmOff ? t.textMuted : t.onPrimary }]}>
              {confirm.label}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Overlay.dim,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '85%',
    borderRadius: Radius.lg,
    padding: Spacing.four,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.four,
  },
  btn: {
    flex: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
});
