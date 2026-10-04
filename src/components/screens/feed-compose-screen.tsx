import { Image } from 'expo-image';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { FEED_BOARD_TYPES, FeedBoardTabs } from '@/components/feed/feed-board';
import { feedComposeBlocker } from '@/components/screens/feed/board-rules';
import type { FeedBoardType, FeedDraftImage } from '@/components/screens/feed/types';
import { Icon } from '@/components/ui/icon';
import { Loading } from '@/components/ui/loading';
import { ScreenHeader } from '@/components/ui/screen-header';
import { FEED_DEFAULT_BOARD, FEED_MAX_CONTENT, FEED_MAX_IMAGES } from '@/constants/feed';
import { Overlay, Radius, Spacing } from '@/constants/theme';
import { useAndroidKeyboardHeight } from '@/hooks/use-android-keyboard-height';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

const NO_IMAGES: FeedDraftImage[] = [];
const THUMB_SIZE = 96;

export type FeedComposeScreenProps = {
  /** 올릴 게시판 (서버 #428) — 기본 자유(`FEED_DEFAULT_BOARD`). */
  board?: FeedBoardType;
  onChangeBoard?: (board: FeedBoardType) => void;
  images?: FeedDraftImage[];
  content?: string;
  onChangeContent?: (content: string) => void;
  /** 사진 고르기 — 셸이 피커를 열고 결과를 훅에 넘긴다. */
  onPickImages?: () => void;
  onRemoveImage?: (key: string) => void;
  onRetryImage?: (key: string) => void;
  onSubmit?: () => void;
  submitting?: boolean;
  onBack?: () => void;
};

/**
 * 피드 게시물 작성 (#1409) — 위에서 게시판(자유/인증, 서버 #428)을 고르고, 사진(고르는 즉시
 * 올리며 장마다 진행 상태)과 본문 2,000자. 자유는 사진 0–10장이되 사진이 없으면 본문 필수,
 * 인증은 사진 1–10장 필수. 고른 사진이 전부 올라가야 [올리기]가 켜진다. 순서 바꾸기는 없다.
 */
export function FeedComposeScreen({
  board = FEED_DEFAULT_BOARD,
  onChangeBoard,
  images = NO_IMAGES,
  content = '',
  onChangeContent,
  onPickImages,
  onRemoveImage,
  onRetryImage,
  onSubmit,
  submitting = false,
  onBack,
}: FeedComposeScreenProps) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  const column = useResponsiveColumn();
  const headerInset = useHeaderContentInset();
  const androidKeyboard = useAndroidKeyboardHeight(Platform.OS === 'android');

  const blocker = feedComposeBlocker(board, images, content);
  const canSubmit = blocker === null && !submitting && !!onSubmit;
  const canAdd = images.length < FEED_MAX_IMAGES && !submitting;
  // 실패한 장은 썸네일의 [다시]가 안내한다 — 아래 문구는 나머지 사유만.
  const hint = blocker && blocker !== 'uploadFailed' ? tr(`feed.compose.${blocker}`) : null;
  const optional = board === 'VERIFICATION' || images.length > 0;

  return (
    <View style={[styles.screen, useScreenStyle(['bottom'])]}>
      <ScreenHeader
        title={tr('feed.compose.title')}
        onBack={onBack}
        right={
          <Pressable
            onPress={onSubmit}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel={tr('feed.compose.submit')}
            accessibilityState={{ disabled: !canSubmit, busy: submitting }}
            testID="feed-compose-submit"
            style={[styles.submit, { backgroundColor: canSubmit ? t.primary : t.disabledBg }]}>
            <Text style={[Typography.label, { color: canSubmit ? t.onPrimary : t.textDisabled }]}>
              {submitting ? tr('feed.compose.submitting') : tr('feed.compose.submit')}
            </Text>
          </Pressable>
        }
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.body,
            column,
            headerInset ? { paddingTop: headerInset } : null,
            androidKeyboard ? { paddingBottom: Spacing.four + androidKeyboard } : null,
          ]}>
          <View style={styles.boardRow}>
            <FeedBoardTabs
              options={FEED_BOARD_TYPES}
              value={board}
              onChange={onChangeBoard}
              disabled={submitting || !onChangeBoard}
              testID="feed-compose-board"
            />
            <Text style={[Typography.supporting, styles.boardHint, { color: t.textMuted }]}>
              {board === 'FREE'
                ? tr('feed.compose.boardHintFree')
                : tr('feed.compose.boardHintVerification')}
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.thumbs}>
              {canAdd ? (
                <Pressable
                  onPress={onPickImages}
                  accessibilityRole="button"
                  accessibilityLabel={tr('feed.compose.addPhotoA11y', {
                    count: images.length,
                    max: FEED_MAX_IMAGES,
                  })}
                  style={[styles.thumb, styles.addTile, { backgroundColor: t.surfaceMuted }]}>
                  <Icon name="camera" size={26} color={t.icon} />
                  <Text style={[Typography.supporting, { color: t.textMuted }]}>
                    {tr('feed.compose.counter', { count: images.length, max: FEED_MAX_IMAGES })}
                  </Text>
                </Pressable>
              ) : null}
              {images.map((img, i) => (
                <View key={img.key} style={styles.thumb} testID={`feed-draft-${img.key}`}>
                  {img.uri ? (
                    <Image
                      source={{ uri: img.uri }}
                      style={[StyleSheet.absoluteFill, styles.thumbImage]}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      style={[
                        StyleSheet.absoluteFill,
                        styles.thumbImage,
                        { backgroundColor: t.surfaceMuted },
                      ]}
                    />
                  )}
                  {img.status === 'uploading' ? (
                    <View
                      style={[styles.thumbState, { backgroundColor: Overlay.dim }]}
                      accessibilityLabel={tr('feed.compose.uploading')}>
                      <Loading size="small" delayMs={0} />
                    </View>
                  ) : img.status === 'failed' ? (
                    <Pressable
                      onPress={() => onRetryImage?.(img.key)}
                      accessibilityRole="button"
                      accessibilityLabel={tr('feed.compose.retryUploadA11y', { index: i + 1 })}
                      accessibilityHint={img.error}
                      style={[styles.thumbState, { backgroundColor: Overlay.strong }]}>
                      <Icon name="refresh" size={22} color={t.onPrimary} />
                      <Text style={[Typography.supporting, { color: t.onPrimary }]}>
                        {tr('feed.compose.uploadFailed')}
                      </Text>
                    </Pressable>
                  ) : null}
                  {!submitting ? (
                    <Pressable
                      onPress={() => onRemoveImage?.(img.key)}
                      accessibilityRole="button"
                      accessibilityLabel={tr('feed.compose.removePhotoA11y', { index: i + 1 })}
                      hitSlop={Spacing.two}
                      style={[styles.remove, { backgroundColor: Overlay.strong }]}>
                      <Icon name="close" size={14} color={t.onPrimary} />
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          </ScrollView>
          {hint ? (
            <Text style={[Typography.supporting, { color: t.textMuted }]}>{hint}</Text>
          ) : null}

          <TextInput
            value={content}
            onChangeText={(v) => onChangeContent?.(v.slice(0, FEED_MAX_CONTENT))}
            multiline
            maxLength={FEED_MAX_CONTENT}
            editable={!submitting}
            placeholder={
              optional
                ? tr('feed.compose.contentPlaceholder')
                : tr('feed.compose.contentPlaceholderRequired')
            }
            placeholderTextColor={t.textMuted}
            accessibilityLabel={tr('feed.compose.contentLabel')}
            style={[
              Typography.body,
              styles.content,
              { backgroundColor: t.surfaceMuted, color: t.text },
            ]}
          />
          <Text style={[Typography.supporting, styles.counter, { color: t.textMuted }]}>
            {tr('feed.compose.counter', { count: content.length, max: FEED_MAX_CONTENT })}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  body: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  boardRow: {
    gap: Spacing.one,
  },
  boardHint: {
    textAlign: 'center',
  },
  submit: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
  },
  thumbs: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: Radius.md,
  },
  thumbImage: {
    borderRadius: Radius.md,
  },
  addTile: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  thumbState: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
  },
  remove: {
    position: 'absolute',
    top: -Spacing.one,
    right: -Spacing.one,
    width: Spacing.four,
    height: Spacing.four,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    minHeight: 160,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    textAlignVertical: 'top',
  },
  counter: {
    alignSelf: 'flex-end',
  },
});
