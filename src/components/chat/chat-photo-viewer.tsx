import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { pressedStyle } from '@/components/ui/press-feedback';
import { MediaViewer, Radius, Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

/** 둥근 버튼 지름 — 손가락이 닿는 최소 크기(44pt). */
const CONTROL_SIZE = 44;

export type ChatPhotoViewerProps = {
  visible: boolean;
  /** 보여줄 사진 — 없으면 뷰어를 그리지 않는다. */
  uri?: string | null;
  /** 보낸 사람 이름. */
  senderName?: string;
  /** 보낸 날짜·시각 문구("11월 11일 수요일 오후 8:30") — 보내는 중이라 아직 없으면 생략. */
  sentLabel?: string;
  /** [피드에 올리기] — 없으면 버튼을 그리지 않는다(남의 사진, 피드가 꺼진 빌드). */
  onShareToFeed?: () => void;
  onClose: () => void;
};

/**
 * 채팅 사진 전체 화면 보기 (2026-11-11 제보) — 종전에는 테마 바탕(크림) 위에 사진이 작게 떠 있고
 * 오른쪽 위에 "닫기" 글자만 있어 화면이 붕 떠 보였다. 사진 보기의 익숙한 틀로 바꾼다: 검정 바탕에
 * 사진을 화면 폭까지 채우고, 왼쪽 위에 뒤로가기와 보낸 사람·보낸 시각, 가운데 아래에 [피드에 올리기].
 */
export function ChatPhotoViewer({
  visible,
  uri,
  senderName,
  sentLabel,
  onShareToFeed,
  onClose,
}: ChatPhotoViewerProps) {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const tr = useT();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible && !!uri}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}>
      {/* 검정 바탕 위라 상태바 글자는 흰색으로. */}
      {visible && uri ? <StatusBar style="light" /> : null}
      <View style={styles.root} testID="chat-photo-viewer">
        <View style={[styles.header, { paddingTop: insets.top + Spacing.two }]}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={tr('house.chat.closePhoto')}
            hitSlop={Spacing.two}
            style={({ pressed }) => [styles.control, pressed && pressedStyle('dim', t)]}>
            <Icon name="back" size={24} color={MediaViewer.text} />
          </Pressable>
          <View style={styles.info}>
            {senderName ? (
              <Text
                style={[Typography.label, emph('semibold'), styles.onDark]}
                numberOfLines={1}
                testID="chat-photo-sender">
                {senderName}
              </Text>
            ) : null}
            {sentLabel ? (
              <Text
                style={[Typography.supporting, styles.sent]}
                numberOfLines={1}
                testID="chat-photo-sent">
                {sentLabel}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.stage}>
          {uri ? (
            <Image
              source={{ uri }}
              style={styles.fill}
              contentFit="contain"
              cachePolicy="none"
              accessibilityLabel={tr('house.chat.openPhoto')}
            />
          ) : null}
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.three }]}>
          {onShareToFeed ? (
            <Pressable
              onPress={onShareToFeed}
              accessibilityRole="button"
              accessibilityLabel={tr('house.chat.sharePhotoToFeed')}
              hitSlop={Spacing.two}
              style={({ pressed }) => [styles.share, pressed && pressedStyle('dim', t)]}>
              <Icon name="image" size={20} color={MediaViewer.text} />
              <Text style={[Typography.label, emph('semibold'), styles.onDark]}>
                {tr('house.chat.sharePhotoToFeed')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: MediaViewer.backdrop },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  info: { flex: 1 },
  onDark: { color: MediaViewer.text },
  sent: { color: MediaViewer.textMuted },
  control: {
    width: CONTROL_SIZE,
    height: CONTROL_SIZE,
    borderRadius: CONTROL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MediaViewer.control,
  },
  stage: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  footer: { alignItems: 'center', paddingTop: Spacing.three },
  share: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: CONTROL_SIZE,
    paddingHorizontal: Spacing.five,
    borderRadius: Radius.pill,
    backgroundColor: MediaViewer.control,
  },
});
