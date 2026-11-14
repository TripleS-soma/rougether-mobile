import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import { CroppedImage } from '@/components/chat/cropped-image';
import { AppTextInput as TextInput } from '@/components/ui/app-text-input';
import { Icon } from '@/components/ui/icon';
import { pressedStyle } from '@/components/ui/press-feedback';
import { Radius, Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';
import { croppedAspect } from '@/lib/chat-crop';
import { CHAT_PHOTO_MAX, type ChatPhotoDraft } from '@/lib/pick-chat-photo';

/** 입력칸이 여러 줄로 늘어나도 목록을 다 먹지 않는 높이 — 본문 약 5줄. */
const INPUT_MAX_HEIGHT = 116;
/**
 * 입력줄 치수 — 카카오톡 입력줄을 화면에서 재서 그대로 옮긴 값(pt, 폭 393 기준 2026-11-14).
 * 알약 높이 47 · 화면 가장자리 여백 10 · 왼쪽 버튼 30 · 보내기 32 · 글 시작 위치 알약
 * 왼쪽에서 48.
 */
const SEND_SIZE = 32;
const PHOTO_SIZE = 30;
const ROUND_ICON = 18;
const BAR_MARGIN = 10;
const PILL_PADDING_X = 8;
const PILL_PADDING_Y = 7.5;
/** 보낼 사진 미리보기 한 칸과 그 위에 얹는 빼기 버튼. */
const TRAY_TILE = 72;
const REMOVE_SIZE = 22;
/** 사진 버튼과 글 사이 틈 — 글이 알약 왼쪽에서 48 떨어진 자리에서 시작하게 한다. */
const INPUT_PADDING_LEFT = 10;

export type ChatComposerProps = {
  /** 서버 본문 상한. */
  maxLength: number;
  /** 목록을 못 불러온 동안은 첨부를 막는다. */
  disabled?: boolean;
  /** 글·사진 보내기 — 다듬은(trim) 글로 부른다. 사진만 보낼 땐 빈 문자열. */
  onSend?: (text: string) => void;
  /** 보내려고 담아 둔 사진 — 입력줄 위에 작게 보인다. */
  photos?: ChatPhotoDraft[];
  onPickPhoto?: () => void;
  pickingPhoto?: boolean;
  onRemovePhoto?: (index: number) => void;
  /** 담아 둔 사진을 눌러 자르기 화면을 연다. */
  onEditPhoto?: (index: number) => void;
  /** 입력줄 안쪽을 좁히는 스타일 (웹 중앙 컬럼). */
  columnStyle?: StyleProp<ViewStyle>;
  /** 입력줄 아래 여백 — 안전 영역과 안드로이드 키보드 높이. */
  bottomInset: number;
};

/**
 * 채팅 입력줄 — 한 줄 알약 안에 [사진] 글 [보내기]. 고른 사진은 입력줄 위 미리보기 줄에
 * 쌓였다가 보내기 한 번에 글과 함께 **메시지 하나**로 나간다.
 */
export function ChatComposer({
  maxLength,
  disabled = false,
  onSend,
  photos,
  onPickPhoto,
  pickingPhoto = false,
  onRemovePhoto,
  onEditPhoto,
  columnStyle,
  bottomInset,
}: ChatComposerProps) {
  const t = useTokens();
  const tr = useT();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const [draft, setDraft] = useState('');
  // 같은 렌더에서 보내기가 두 번 눌려도 같은 글이 두 번 나가지 않게, 보낼 때는 state가 아니라
  // ref를 읽고 그 자리에서 비운다.
  const draftRef = useRef('');
  const changeDraft = (text: string) => {
    draftRef.current = text;
    setDraft(text);
  };

  const trimmed = draft.trim();
  const photoCount = photos?.length ?? 0;
  const canSend = (trimmed.length > 0 || photoCount > 0) && !!onSend;
  const send = () => {
    if (!canSend) return;
    const text = draftRef.current.trim();
    changeDraft('');
    // 담아 둔 사진은 부모가 들고 있다 — 사진이 있으면 글이 비어도 넘긴다.
    if (text.length > 0 || photoCount > 0) onSend?.(text);
  };
  const photoFull = photoCount >= CHAT_PHOTO_MAX;

  const removeButton = (label: string, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={Spacing.two}
      style={[styles.remove, { backgroundColor: t.text }]}>
      <Icon name="close" size={14} color={t.surface} />
    </Pressable>
  );

  return (
    <View style={{ backgroundColor: t.surface }}>
      {photoCount > 0 ? (
        <View style={[styles.tray, { borderTopColor: t.border }]} testID="chat-composer-tray">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.trayContent, columnStyle]}>
            {photos?.map((photo, index) => (
              <View key={`${photo.uri}-${index}`} style={styles.tile}>
                <Pressable
                  onPress={() => onEditPhoto?.(index)}
                  disabled={!onEditPhoto}
                  accessibilityRole="button"
                  accessibilityLabel={tr('house.chat.editPhoto', { n: index + 1 })}
                  style={[styles.tileImage, { backgroundColor: t.surfaceMuted }]}>
                  <CroppedImage
                    uri={photo.uri}
                    aspect={croppedAspect(photo.width, photo.height)}
                    crop={photo.crop}
                    style={StyleSheet.absoluteFill}
                  />
                  {onEditPhoto ? (
                    <View style={[styles.cropBadge, { backgroundColor: t.text }]}>
                      <Icon name="crop" size={12} color={t.surface} />
                    </View>
                  ) : null}
                </Pressable>
                {onRemovePhoto
                  ? removeButton(tr('house.chat.removePhoto', { n: index + 1 }), () =>
                      onRemovePhoto(index),
                    )
                  : null}
              </View>
            ))}
          </ScrollView>
          <Text style={[Typography.caption, emph('normal'), styles.count, { color: t.textMuted }]}>
            {tr('house.chat.photoCount', { n: photoCount, max: CHAT_PHOTO_MAX })}
          </Text>
        </View>
      ) : null}
      <View style={[styles.inputRow, { paddingBottom: bottomInset }]}>
        {/* 카카오톡식 한 줄 알약 — [사진] 글 [보내기]가 한 칸 안에 들어간다. */}
        <View style={[styles.pill, { backgroundColor: t.surfaceMuted }, columnStyle]}>
          {onPickPhoto ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tr('house.chat.pickPhoto')}
              accessibilityState={{ disabled: pickingPhoto || disabled || photoFull }}
              disabled={pickingPhoto || disabled || photoFull}
              onPress={onPickPhoto}
              hitSlop={Spacing.two}
              style={({ pressed }) => [
                styles.round,
                styles.photo,
                { backgroundColor: t.surface },
                pressed && pressedStyle('dim', t),
              ]}>
              {pickingPhoto ? (
                <ActivityIndicator size="small" color={t.primary} />
              ) : (
                <Icon
                  name="image"
                  size={ROUND_ICON}
                  color={photoFull ? t.textMuted : t.primaryText}
                />
              )}
            </Pressable>
          ) : null}
          <TextInput
            value={draft}
            onChangeText={changeDraft}
            placeholder={tr('house.chat.placeholder')}
            placeholderTextColor={t.textMuted}
            accessibilityLabel={tr('house.chat.inputA11y')}
            multiline
            // 웹의 여러 줄 입력칸은 기본이 두 줄 높이다 — 네이티브처럼 한 줄에서 시작하게 한다.
            // 네이티브에는 주지 않는다(안드로이드는 줄 수를 고정해 버려 늘어나지 않는다).
            {...(Platform.OS === 'web' ? { rows: 1 } : null)}
            maxLength={maxLength}
            style={[
              styles.input,
              Typography.body,
              emph('normal'),
              // 한 줄일 때 글자가 둥근 버튼들과 같은 높이 가운데에 오게 한다(글자 크기 설정을 따른다).
              { paddingVertical: Math.max(0, (SEND_SIZE - Typography.body.lineHeight) / 2) },
              { color: t.text },
            ]}
          />
          <Pressable
            onPress={send}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel={tr('house.chat.send')}
            accessibilityState={{ disabled: !canSend }}
            hitSlop={Spacing.one}
            style={({ pressed }) => [
              styles.round,
              { backgroundColor: canSend ? t.primary : t.surface },
              pressed && canSend && pressedStyle('fill', t),
            ]}>
            <Icon name="send-up" size={ROUND_ICON} color={canSend ? t.onPrimary : t.textMuted} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tray: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.two },
  trayContent: { paddingHorizontal: Spacing.three, gap: Spacing.two },
  tile: { width: TRAY_TILE + REMOVE_SIZE / 2, height: TRAY_TILE + REMOVE_SIZE / 2 },
  tileImage: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: TRAY_TILE,
    height: TRAY_TILE,
    borderRadius: Radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cropBadge: {
    position: 'absolute',
    left: Spacing.one,
    bottom: Spacing.one,
    width: REMOVE_SIZE,
    height: REMOVE_SIZE,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remove: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: REMOVE_SIZE,
    height: REMOVE_SIZE,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: { paddingHorizontal: Spacing.three, paddingTop: Spacing.one },
  inputRow: { paddingHorizontal: BAR_MARGIN, paddingTop: Spacing.two },
  pill: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: PILL_PADDING_X,
    paddingVertical: PILL_PADDING_Y,
    borderRadius: (SEND_SIZE + PILL_PADDING_Y * 2) / 2,
    borderCurve: 'continuous',
  },
  input: {
    flex: 1,
    maxHeight: INPUT_MAX_HEIGHT,
    minHeight: SEND_SIZE,
    paddingLeft: INPUT_PADDING_LEFT,
    paddingRight: Spacing.two,
  },
  round: {
    width: SEND_SIZE,
    height: SEND_SIZE,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 보내기(32)보다 조금 작은 왼쪽 버튼 — 아래 정렬에서 세로 가운데가 맞도록 1만큼 띄운다.
  photo: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    marginBottom: (SEND_SIZE - PHOTO_SIZE) / 2,
  },
});
