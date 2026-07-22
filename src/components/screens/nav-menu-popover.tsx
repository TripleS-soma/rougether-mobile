import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

export type NavMenuPopoverProps = {
  visible: boolean;
  /** Measured top offset — anchors the popover under the hamburger button. */
  top: number;
  onClose: () => void;
  /** 알림 항목 — 미배선이면 숨김 (#257). */
  onOpenNotifications?: () => void;
  /** 알림 항목의 읽지 않음 점. */
  notificationDot?: boolean;
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
 */
export function NavMenuPopover({
  visible,
  top,
  onClose,
  onOpenNotifications,
  notificationDot = false,
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
      <Pressable style={styles.popoverBackdrop} onPress={onClose}>
        <View style={[styles.popover, { top, backgroundColor: t.screen, borderColor: t.border }]}>
          {(
            [
              ...(onOpenNotifications
                ? [
                    {
                      icon: 'bell' as const,
                      label: '알림',
                      dot: notificationDot,
                      onPress: () => onOpenNotifications(),
                    },
                  ]
                : []),
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
            ] as { icon: IconName; label: string; dot?: boolean; onPress: () => void }[]
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
              {item.dot ? (
                <View style={[styles.popoverDot, { backgroundColor: t.danger }]} />
              ) : null}
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  popoverBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  popover: {
    // `top` comes from the measured hamburger position.
    position: 'absolute',
    right: Spacing.four,
    minWidth: 176,
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
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
  popoverDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 'auto',
  },
});
