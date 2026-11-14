import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from 'react-native';

import { onSessionCleared } from '@/api/auth';
import { fetchChatImage } from '@/api/chat-images';
import { ChatPhotoViewer } from '@/components/chat/chat-photo-viewer';
import { CroppedImage } from '@/components/chat/cropped-image';
import { Icon } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';
import { useT } from '@/i18n';
import { croppedAspect, isFullCrop } from '@/lib/chat-crop';
import type { ChatPhotoDraft } from '@/lib/pick-chat-photo';

export const CHAT_PHOTO_SIZE = 184;
const RETRY_ICON = 24;

/** 사진은 화면이 떠나거나 백그라운드로 가면 버리고, 복귀 시 권한을 다시 확인한다. */
export function ChatPhoto({
  imageId,
  local,
  senderName,
  sentLabel,
  onShareToFeed,
  onLongPress,
  style,
}: {
  imageId?: number;
  /** 아직 올리는 중인 내 사진 — 자르기 영역이 있으면 자른 모습으로 그린다. */
  local?: ChatPhotoDraft;
  /** 크게 보기 화면에 띄울 보낸 사람·보낸 시각. */
  senderName?: string;
  sentLabel?: string;
  /** 크게 보기의 [피드에 올리기] — 없으면 버튼을 그리지 않는다. 지금 보이는 사진의 주소로 부른다. */
  onShareToFeed?: (uri: string) => void;
  /** 길게 누르기 — 말풍선의 메뉴(공감·신고)를 연다. */
  onLongPress?: () => void;
  /** 칸 크기 — 주지 않으면 한 장짜리 기본 크기. */
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTokens();
  const tr = useT();
  const [uri, setUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [active, setActive] = useState(AppState.currentState !== 'background');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      const visible = state === 'active';
      setActive(visible);
      if (!visible) {
        setUri(null);
        setExpanded(false);
      }
    });
    const clear = onSessionCleared(() => {
      setUri(null);
      setExpanded(false);
      setActive(false);
    });
    return () => {
      sub.remove();
      clear();
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    setUri(null);
    if (!active || imageId == null) return;
    setLoading(true);
    void fetchChatImage(imageId)
      .then((value) => {
        if (!cancelled) setUri(value);
      })
      .catch(() => {
        if (!cancelled) setUri(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [imageId, active, attempt]);
  const source = active ? (imageId == null ? local?.uri : uri) : null;
  // 자른 사진은 올라가기 전까지 원본 파일뿐이라, 크게 보기는 서버 사진이 온 뒤에 연다.
  const croppedLocal = imageId == null && !!local && !isFullCrop(local.crop);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tr(source ? 'house.chat.openPhoto' : 'house.chat.retryPhoto')}
        onPress={() => {
          if (!source) setAttempt((value) => value + 1);
          else if (!croppedLocal) setExpanded(true);
        }}
        onLongPress={onLongPress}
        style={[styles.photo, { backgroundColor: t.surfaceMuted }, style]}>
        {source && croppedLocal && local ? (
          <CroppedImage
            uri={source}
            aspect={croppedAspect(local.width, local.height)}
            crop={local.crop}
            style={StyleSheet.absoluteFill}
          />
        ) : source ? (
          <Image
            source={{ uri: source }}
            style={styles.fill}
            contentFit="cover"
            cachePolicy="none"
          />
        ) : loading ? (
          <ActivityIndicator color={t.primary} />
        ) : (
          // 묶음의 작은 칸에는 문구가 들어가지 않는다 — 다시 불러오기 아이콘만 두고, 뜻은
          // 버튼 이름(다시 불러오기)이 읽어 준다.
          <Icon name="refresh" size={RETRY_ICON} color={t.textMuted} />
        )}
      </Pressable>
      <ChatPhotoViewer
        visible={expanded}
        uri={source}
        senderName={senderName}
        sentLabel={sentLabel}
        onShareToFeed={
          onShareToFeed && source
            ? () => {
                // 뷰어(모달)를 먼저 닫는다 — 열린 채 화면이 바뀌면 작성 화면을 덮는다.
                setExpanded(false);
                onShareToFeed(source);
              }
            : undefined
        }
        onClose={() => setExpanded(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  photo: {
    width: CHAT_PHOTO_SIZE,
    height: CHAT_PHOTO_SIZE,
    borderRadius: Radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: { width: '100%', flex: 1 },
});
