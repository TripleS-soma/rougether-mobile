import * as Clipboard from 'expo-clipboard';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

/** iOS 시스템 붙여넣기 버튼은 크기를 직접 줘야 보인다(ClipboardPasteButton 문서). */
const PASTE_BUTTON_H = 48;
const PASTE_BUTTON_W = 200;

export type InvitePasteSheetProps = {
  visible: boolean;
  /** 붙여넣은 글 — 초대코드인지는 부모가 판정한다. */
  onPaste?: (text: string) => void;
  /** 아니에요·백드롭. */
  onDismiss?: () => void;
  /** 붙여넣은 글에서 코드를 못 찾았을 때 안내. */
  error?: string | null;
};

/**
 * 온보딩 직후 1회 "친구에게 초대받아 오셨나요?" (#1007).
 *
 * 설치 전에 초대 링크를 누른 사람은 설치하면서 코드를 잃는다. 랜딩이 코드를
 * 클립보드에 넣어 두니 여기서 붙여넣게 한다. **자동으로 읽지 않는다** — iOS는
 * 클립보드를 읽을 때마다 "붙여넣기 허용" 팝업을 띄워 초대 안 받은 사람까지 묻게
 * 된다. iOS 16+는 시스템 붙여넣기 버튼(`ClipboardPasteButton`)이라 팝업이 없고,
 * 그 밖의 플랫폼은 버튼을 누를 때 읽는다.
 */
export function InvitePasteSheet({ visible, onPaste, onDismiss, error }: InvitePasteSheetProps) {
  const t = useTokens();
  const Typography = useTypography();
  const systemPaste = Platform.OS === 'ios' && Clipboard.isPasteButtonAvailable === true;

  const pasteFromClipboard = async () => {
    try {
      onPaste?.(await Clipboard.getStringAsync());
    } catch {
      onPaste?.('');
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onDismiss}
      cardStyle={[styles.sheet, { backgroundColor: t.screen }]}>
      <View style={[styles.handle, { backgroundColor: t.border }]} />
      <Text style={[Typography.h2, { color: t.text }]}>친구에게 초대받아 오셨나요?</Text>
      <Text style={[Typography.body, styles.body, { color: t.textMuted }]}>
        초대 페이지에서 복사한 초대코드를 붙여넣으면 코인을 받아요.
      </Text>
      <View style={styles.pasteRow}>
        {systemPaste ? (
          <Clipboard.ClipboardPasteButton
            onPress={(data) => {
              if (data.type === 'text') onPaste?.(data.text);
            }}
            acceptedContentTypes={['plain-text']}
            displayMode="iconAndLabel"
            backgroundColor={t.primary}
            foregroundColor={t.onPrimary}
            style={styles.systemPaste}
          />
        ) : (
          <Pressable
            onPress={() => void pasteFromClipboard()}
            accessibilityRole="button"
            accessibilityLabel="초대코드 붙여넣기"
            style={[styles.pasteBtn, { backgroundColor: t.primary }]}>
            <Icon name="copy" size={16} color={t.onPrimary} />
            <Text style={[Typography.label, { color: t.onPrimary }]}>붙여넣기</Text>
          </Pressable>
        )}
      </View>
      {error ? (
        <Text style={[Typography.supporting, styles.center, { color: t.danger }]}>{error}</Text>
      ) : null}
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="초대받지 않았어요"
        style={styles.dismiss}>
        <Text style={[Typography.supporting, { color: t.textMuted }]}>아니에요</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: Radius.pill,
    marginBottom: Spacing.one,
  },
  body: {
    lineHeight: 24,
  },
  center: {
    textAlign: 'center',
  },
  pasteRow: {
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  systemPaste: {
    height: PASTE_BUTTON_H,
    width: PASTE_BUTTON_W,
  },
  pasteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: PASTE_BUTTON_H,
    minWidth: PASTE_BUTTON_W,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.four,
  },
  dismiss: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
});
