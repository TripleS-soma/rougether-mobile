import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text } from 'react-native';

import { onSessionCleared } from '@/api/auth';
import { fetchChatImage } from '@/api/chat-images';
import { ChatPhotoViewer } from '@/components/chat/chat-photo-viewer';
import { Radius } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

const CHAT_PHOTO_SIZE = 184;

/** 사진은 화면이 떠나거나 백그라운드로 가면 버리고, 복귀 시 권한을 다시 확인한다. */
export function ChatPhoto({
  imageId,
  localUri,
  senderName,
  sentLabel,
  onShareToFeed,
}: {
  imageId?: number;
  localUri?: string;
  /** 크게 보기 화면에 띄울 보낸 사람·보낸 시각. */
  senderName?: string;
  sentLabel?: string;
  /** 크게 보기의 [피드에 올리기] — 없으면 버튼을 그리지 않는다. 지금 보이는 사진의 주소로 부른다. */
  onShareToFeed?: (uri: string) => void;
}) {
  const t = useTokens();
  const Typography = useTypography();
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
  const source = active ? (imageId == null ? localUri : uri) : null;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tr(source ? 'house.chat.openPhoto' : 'house.chat.retryPhoto')}
        onPress={() => (source ? setExpanded(true) : setAttempt((value) => value + 1))}
        style={[styles.photo, { backgroundColor: t.surfaceMuted }]}>
        {source ? (
          <Image
            source={{ uri: source }}
            style={styles.fill}
            contentFit="cover"
            cachePolicy="none"
          />
        ) : loading ? (
          <ActivityIndicator color={t.primary} />
        ) : (
          <Text style={[Typography.supporting, { color: t.textMuted }]}>
            {tr('house.chat.photoFailed')}
          </Text>
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
