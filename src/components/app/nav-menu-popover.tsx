import { Modal, Pressable, StyleSheet, Text } from 'react-native';

import { GlassSurface } from '@/components/ui/glass-surface';
import { Icon, type IconName } from '@/components/ui/icon';
import { Overlay, Radius, ShadowColor, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

export type NavMenuPopoverProps = {
  visible: boolean;
  /** Measured top offset — anchors the popover under the hamburger button. */
  top: number;
  /**
   * 버튼 아래 여백(창 바닥 기준) — 있으면 `top` 대신 이걸로 버튼 **위에** 연다
   * (#1055). 메뉴 버튼이 방 오른쪽 아래로 내려가 아래로 열면 짧은 화면에서 잘린다.
   */
  bottom?: number;
  onClose: () => void;
  /** 캐릭터 교체 항목 — 미배선이면 숨김 (#260). */
  onOpenCharacterPicker?: () => void;
  /** 방 꾸미기. */
  onEditRoom?: () => void;
  /** 방 이미지 저장 (#245). */
  onSaveRoomImage: () => void;
  /** 카테고리 관리 sheet 열기. */
  onOpenCategoryManager: () => void;
  /** 루틴 관리 — + 버튼의 바로 추가와 분리 (#335). */
  onManageRoutines?: () => void;
};

/**
 * Header hamburger popover: quick links to the management screens. Extracted
 * from my-room-screen (pure move, no behavior change); item visibility follows
 * which callbacks are wired, and every press closes the popover first.
 *
 * 방 작업만 남긴다 (#1089) — 재화 내역·출석 이벤트는 마이페이지 바로가기로 갔다.
 */
export function NavMenuPopover({
  visible,
  top,
  bottom,
  onClose,
  onOpenCharacterPicker,
  onEditRoom,
  onSaveRoomImage,
  onOpenCategoryManager,
  onManageRoutines,
}: NavMenuPopoverProps) {
  const t = useTokens();
  const Typography = useTypography();

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={styles.popoverBackdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="닫기">
        <GlassSurface
          interactive={false}
          fallbackColor={t.screen}
          testID="nav-menu-popover"
          style={[styles.popover, bottom !== undefined ? { bottom } : { top }]}>
          {(
            [
              ...(onOpenCharacterPicker
                ? [
                    {
                      icon: 'profile' as const,
                      label: '캐릭터 교체',
                      onPress: () => onOpenCharacterPicker(),
                    },
                  ]
                : []),
              {
                icon: 'edit' as const,
                label: '방 꾸미기',
                onPress: () => onEditRoom?.(),
              },
              {
                icon: 'camera' as const,
                label: '방 이미지 저장',
                onPress: () => onSaveRoomImage(),
              },
              {
                icon: 'folder' as const,
                label: '카테고리 관리',
                onPress: () => onOpenCategoryManager(),
              },
              {
                icon: 'list' as const,
                label: '루틴 관리',
                onPress: () => onManageRoutines?.(),
              },
            ] as { icon: IconName; label: string; onPress: () => void }[]
          ).map((item, idx, arr) => (
            <Pressable
              key={item.label}
              onPress={() => {
                onClose();
                item.onPress();
              }}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              style={[
                styles.popoverItem,
                idx !== arr.length - 1 && {
                  borderBottomColor: t.border,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                },
              ]}>
              <Icon name={item.icon} size={18} color={t.text} />
              <Text style={[Typography.body, { color: t.text }]}>{item.label}</Text>
            </Pressable>
          ))}
        </GlassSurface>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  popoverBackdrop: {
    flex: 1,
    backgroundColor: Overlay.subtle,
  },
  popover: {
    // `top` comes from the measured hamburger position.
    position: 'absolute',
    right: Spacing.four,
    minWidth: 176,
    borderRadius: Radius.md,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: ShadowColor,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  popoverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
});
