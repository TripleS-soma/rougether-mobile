import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { onSessionCleared } from '@/api/auth';
import { fetchChatImage } from '@/api/chat-images';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

/** 사진은 화면이 떠나거나 백그라운드로 가면 버리고, 복귀 시 권한을 다시 확인한다. */
export function ChatPhoto({ imageId, localUri }: { imageId?: number; localUri?: string }) {
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
      <Modal
        visible={expanded && !!source}
        animationType="fade"
        onRequestClose={() => setExpanded(false)}>
        <View style={[styles.viewer, { backgroundColor: t.screen }]}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setExpanded(false)}
            style={styles.close}>
            <Text style={[Typography.label, { color: t.text }]}>{tr('house.chat.closePhoto')}</Text>
          </Pressable>
          {source ? (
            <Image
              source={{ uri: source }}
              style={styles.fill}
              contentFit="contain"
              cachePolicy="none"
            />
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  photo: {
    width: 184,
    height: 184,
    borderRadius: Radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: { width: '100%', flex: 1 },
  viewer: { flex: 1, paddingTop: Spacing.six * 2, paddingBottom: Spacing.six },
  close: { alignSelf: 'flex-end', padding: Spacing.four },
});
