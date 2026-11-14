import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ChatCrop } from '@/api/chat-types';
import { pressedStyle } from '@/components/ui/press-feedback';
import { MediaViewer, Overlay, Radius, Spacing } from '@/constants/theme';
import { useLatestRef } from '@/hooks/use-stable-value';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';
import { centeredCrop, type CropHandle, dragCrop, FULL_CROP, isFullCrop } from '@/lib/chat-crop';
import type { ChatPhotoDraft } from '@/lib/pick-chat-photo';

/** 모서리 손잡이의 터치 영역과 보이는 꺾쇠 크기. */
const HANDLE_HIT = 44;
const HANDLE_MARK = 20;
const HANDLE_THICKNESS = 3;
const FRAME_BORDER = 1;

const CORNERS: Exclude<CropHandle, 'move'>[] = ['tl', 'tr', 'bl', 'br'];
/** 비율 맞추기 — 가로:세로. */
const PRESETS: { key: string; label: string; ratio: number }[] = [
  { key: 'square', label: '1:1', ratio: 1 },
  { key: 'landscape', label: '4:3', ratio: 4 / 3 },
  { key: 'portrait', label: '3:4', ratio: 3 / 4 },
];

type Rect = { left: number; top: number; width: number; height: number };

/** `stage` 안에 가로/세로 비율 `aspect`인 사진을 '맞춤'으로 넣은 자리. */
export function fitRect(stage: { width: number; height: number }, aspect: number): Rect {
  if (stage.width <= 0 || stage.height <= 0 || !(aspect > 0))
    return { left: 0, top: 0, width: 0, height: 0 };
  const stageAspect = stage.width / stage.height;
  const width = aspect >= stageAspect ? stage.width : stage.height * aspect;
  const height = width / aspect;
  return { left: (stage.width - width) / 2, top: (stage.height - height) / 2, width, height };
}

export type ChatPhotoCropProps = {
  /** 자를 사진 — null이면 화면을 닫는다. */
  photo: ChatPhotoDraft | null;
  /** [완료] — 사진 전체를 고른 상태면 undefined(자르지 않음). */
  onDone: (crop: ChatCrop | undefined) => void;
  onCancel: () => void;
};

/**
 * 보내기 전 사진 자르기 — 사진 위의 틀을 끌어 옮기고 네 모서리로 크기를 바꾼다. 여기서는 영역만
 * 정하고 파일은 건드리지 않는다: 서버가 올릴 때 그 영역만 남기므로 화질이 한 번만 깎이고,
 * 네이티브 이미지 편집 모듈 없이(OTA로) 나갈 수 있다.
 */
export function ChatPhotoCrop({ photo, onDone, onCancel }: ChatPhotoCropProps) {
  const t = useTokens();
  const tr = useT();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const insets = useSafeAreaInsets();
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const [crop, setCrop] = useState<ChatCrop>(FULL_CROP);
  // 고른 사진의 크기를 모를 때(일부 Android 선택기)는 불러온 그림에서 읽는다.
  const [loadedAspect, setLoadedAspect] = useState<number | null>(null);
  const uri = photo?.uri;
  useEffect(() => {
    setCrop(photo?.crop ?? FULL_CROP);
    setLoadedAspect(null);
    // 사진이 바뀔 때만 초기화한다 — 같은 사진의 crop 참조가 흔들려도 편집 중인 값을 지키려고.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri]);
  const aspect = photo?.width && photo?.height ? photo.width / photo.height : (loadedAspect ?? 0);
  const image = useMemo(() => fitRect(stage, aspect), [stage, aspect]);

  const cropRef = useLatestRef(crop);
  const imageRef = useLatestRef(image);
  const startRef = useRef<ChatCrop>(FULL_CROP);
  // PanResponder는 한 번만 만든다 — 최신 값은 ref로 읽는다.
  const responders = useMemo(() => {
    const make = (handle: CropHandle) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          startRef.current = cropRef.current;
        },
        onPanResponderMove: (_event, gesture) => {
          const { width, height } = imageRef.current;
          if (width <= 0 || height <= 0) return;
          setCrop(dragCrop(startRef.current, handle, gesture.dx / width, gesture.dy / height));
        },
      });
    return { move: make('move'), tl: make('tl'), tr: make('tr'), bl: make('bl'), br: make('br') };
  }, [cropRef, imageRef]);

  const onStageLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setStage((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  };

  const frame: Rect = {
    left: image.left + crop.x * image.width,
    top: image.top + crop.y * image.height,
    width: crop.width * image.width,
    height: crop.height * image.height,
  };
  const ready = image.width > 0;
  const chip = (key: string, label: string, onPress: () => void, a11y: string) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.chip, pressed && pressedStyle('dim', t)]}>
      <Text style={[Typography.label, emph('normal'), styles.onDark]}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal
      visible={photo != null}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}>
      {photo ? <StatusBar style="light" /> : null}
      <View style={styles.root} testID="chat-photo-crop">
        <View style={[styles.header, { paddingTop: insets.top + Spacing.two }]}>
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            hitSlop={Spacing.two}
            style={({ pressed }) => [styles.headerButton, pressed && pressedStyle('dim', t)]}>
            <Text style={[Typography.label, emph('normal'), styles.onDark]}>
              {tr('house.chat.cropCancel')}
            </Text>
          </Pressable>
          <Text style={[Typography.label, emph('semibold'), styles.onDark]}>
            {tr('house.chat.cropTitle')}
          </Text>
          <Pressable
            onPress={() => onDone(isFullCrop(crop) ? undefined : crop)}
            accessibilityRole="button"
            hitSlop={Spacing.two}
            style={({ pressed }) => [styles.headerButton, pressed && pressedStyle('dim', t)]}>
            <Text style={[Typography.label, emph('semibold'), styles.onDark]}>
              {tr('house.chat.cropDone')}
            </Text>
          </Pressable>
        </View>
        <View style={styles.stage} onLayout={onStageLayout}>
          {uri ? (
            <Image
              source={{ uri }}
              style={ready ? [styles.placed, image] : [StyleSheet.absoluteFill, styles.measuring]}
              contentFit="contain"
              cachePolicy="none"
              onLoad={(event) => {
                const { width, height } = event.source;
                if (width > 0 && height > 0) setLoadedAspect(width / height);
              }}
            />
          ) : null}
          {ready ? (
            <>
              {/* 틀 바깥 네 띠를 어둡게 — 남는 영역이 한눈에 보인다. */}
              <View
                pointerEvents="none"
                style={[
                  styles.shade,
                  {
                    left: image.left,
                    top: image.top,
                    width: image.width,
                    height: frame.top - image.top,
                  },
                ]}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.shade,
                  {
                    left: image.left,
                    top: frame.top + frame.height,
                    width: image.width,
                    height: image.top + image.height - frame.top - frame.height,
                  },
                ]}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.shade,
                  {
                    left: image.left,
                    top: frame.top,
                    width: frame.left - image.left,
                    height: frame.height,
                  },
                ]}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.shade,
                  {
                    left: frame.left + frame.width,
                    top: frame.top,
                    width: image.left + image.width - frame.left - frame.width,
                    height: frame.height,
                  },
                ]}
              />
              <View
                {...responders.move.panHandlers}
                style={[styles.frame, frame]}
                accessible
                accessibilityLabel={tr('house.chat.cropFrameA11y')}
                testID="chat-crop-frame"
              />
              {CORNERS.map((corner) => {
                const right = corner === 'tr' || corner === 'br';
                const bottom = corner === 'bl' || corner === 'br';
                return (
                  <View
                    key={corner}
                    {...responders[corner].panHandlers}
                    testID={`chat-crop-${corner}`}
                    style={[
                      styles.handle,
                      {
                        left: frame.left + (right ? frame.width : 0) - HANDLE_HIT / 2,
                        top: frame.top + (bottom ? frame.height : 0) - HANDLE_HIT / 2,
                      },
                    ]}>
                    <View
                      style={[
                        styles.mark,
                        right ? styles.markRight : styles.markLeft,
                        bottom ? styles.markBottom : styles.markTop,
                      ]}
                    />
                  </View>
                );
              })}
            </>
          ) : null}
        </View>
        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.three }]}>
          {chip(
            'reset',
            tr('house.chat.cropReset'),
            () => setCrop(FULL_CROP),
            tr('house.chat.cropReset'),
          )}
          {PRESETS.map(({ key, label, ratio }) =>
            chip(
              key,
              label,
              () => aspect > 0 && setCrop(centeredCrop(aspect, ratio)),
              tr('house.chat.cropRatioA11y', { ratio: label }),
            ),
          )}
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
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  headerButton: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.one },
  onDark: { color: MediaViewer.text },
  stage: { flex: 1, margin: Spacing.three },
  placed: { position: 'absolute' },
  // 크기를 모르는 동안은 그림만 불러 비율을 읽는다 — 틀 없이 보이지 않게.
  measuring: { opacity: 0 },
  shade: { position: 'absolute', backgroundColor: Overlay.strong },
  frame: { position: 'absolute', borderWidth: FRAME_BORDER, borderColor: MediaViewer.text },
  handle: {
    position: 'absolute',
    width: HANDLE_HIT,
    height: HANDLE_HIT,
  },
  mark: {
    position: 'absolute',
    width: HANDLE_MARK,
    height: HANDLE_MARK,
    borderColor: MediaViewer.text,
  },
  markLeft: { left: HANDLE_HIT / 2 - HANDLE_THICKNESS, borderLeftWidth: HANDLE_THICKNESS },
  markRight: { right: HANDLE_HIT / 2 - HANDLE_THICKNESS, borderRightWidth: HANDLE_THICKNESS },
  markTop: { top: HANDLE_HIT / 2 - HANDLE_THICKNESS, borderTopWidth: HANDLE_THICKNESS },
  markBottom: { bottom: HANDLE_HIT / 2 - HANDLE_THICKNESS, borderBottomWidth: HANDLE_THICKNESS },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    backgroundColor: MediaViewer.control,
  },
});
