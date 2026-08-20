import { Image } from 'expo-image';
import { memo, useEffect, useMemo } from 'react';
import { type ImageStyle, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { PawPictogram } from '@/components/ui/pictograms';
import { CHARACTER_OPTIONS, type CharacterId } from '@/constants/characters';
import { assetSource, isCdnKey, RESOURCE_BASE } from '@/resources/asset';

import bear1 from '@/assets/images/characters/bear-1.webp';
import bear2 from '@/assets/images/characters/bear-2.webp';
import bear3 from '@/assets/images/characters/bear-3.webp';
import bear4 from '@/assets/images/characters/bear-4.webp';
import cat1 from '@/assets/images/characters/cat-1.webp';
import cat2 from '@/assets/images/characters/cat-2.webp';
import cat3 from '@/assets/images/characters/cat-3.webp';
import cat4 from '@/assets/images/characters/cat-4.webp';
import dog1 from '@/assets/images/characters/dog-1.webp';
import dog2 from '@/assets/images/characters/dog-2.webp';
import dog3 from '@/assets/images/characters/dog-3.webp';
import dog4 from '@/assets/images/characters/dog-4.webp';
import horse1 from '@/assets/images/characters/horse-1.webp';
import horse2 from '@/assets/images/characters/horse-2.webp';
import horse3 from '@/assets/images/characters/horse-3.webp';
import horse4 from '@/assets/images/characters/horse-4.webp';
import otter1 from '@/assets/images/characters/otter-1.webp';
import otter2 from '@/assets/images/characters/otter-2.webp';
import otter3 from '@/assets/images/characters/otter-3.webp';
import otter4 from '@/assets/images/characters/otter-4.webp';
import panda1 from '@/assets/images/characters/panda-1.webp';
import panda2 from '@/assets/images/characters/panda-2.webp';
import panda3 from '@/assets/images/characters/panda-3.webp';
import panda4 from '@/assets/images/characters/panda-4.webp';
import sheep1 from '@/assets/images/characters/sheep-1.webp';
import sheep2 from '@/assets/images/characters/sheep-2.webp';
import sheep3 from '@/assets/images/characters/sheep-3.webp';
import sheep4 from '@/assets/images/characters/sheep-4.webp';
import tiger1 from '@/assets/images/characters/tiger-1.webp';
import tiger2 from '@/assets/images/characters/tiger-2.webp';
import tiger3 from '@/assets/images/characters/tiger-3.webp';
import tiger4 from '@/assets/images/characters/tiger-4.webp';

/** Static pose frames per character (index 0–3). */
const SPRITES: Record<CharacterId, number[]> = {
  bear: [bear1, bear2, bear3, bear4],
  cat: [cat1, cat2, cat3, cat4],
  dog: [dog1, dog2, dog3, dog4],
  horse: [horse1, horse2, horse3, horse4],
  otter: [otter1, otter2, otter3, otter4],
  panda: [panda1, panda2, panda3, panda4],
  sheep: [sheep1, sheep2, sheep3, sheep4],
  tiger: [tiger1, tiger2, tiger3, tiger4],
};

/** Number of poses available per character. */
const POSE_COUNT = 4;

/** `pose` wraps over however many frames the avatar actually has. */
function wrapPose(pose: number, count: number) {
  return ((pose % count) + count) % count;
}

export type CharacterAvatarProps = {
  characterId: CharacterId;
  /**
   * 서버가 등록한 포즈 프레임(CDN 키) — 등록 순서 그대로. 유효한 키가 하나라도
   * 있으면 번들 스프라이트 대신 이 애니메이션 webp를 그리고, `pose`가 이 목록을
   * 순환한다 (#735).
   */
  frames?: string[];
  /** Which pose frame to show; wraps over the available frames. Defaults to 0. */
  pose?: number;
  size?: number;
  style?: StyleProp<ImageStyle>;
  /** 원본 해상도 디코딩 — 카메라 줌 대상(집 창문)용. */
  sharp?: boolean;
};

/**
 * Renders a character via `expo-image`: the server's CDN pose frames (animated
 * webp) when `frames` carries a valid key, else the bundled static pose frame.
 * `pose` selects the frame (the room in 나의 방 cycles it on tap; elsewhere it
 * stays at 0). Falls back to the paw mark if no art exists. Shared by the room
 * and any single-character display.
 */
export const CharacterAvatar = memo(function CharacterAvatar({
  characterId,
  frames,
  pose = 0,
  size = 96,
  style,
  sharp = false,
}: CharacterAvatarProps) {
  const character = useMemo(
    () => CHARACTER_OPTIONS.find((c) => c.id === characterId) ?? CHARACTER_OPTIONS[0],
    [characterId],
  );

  // 탭 순환 순서 = 서버 등록 순서. 유효하지 않은 키는 조용히 버린다.
  // 포즈 탭마다(그리고 부모 리렌더마다) 배열을 새로 걸러내던 것을 프레임 목록이
  // 실제로 바뀔 때만 하도록 묶는다 — 방 캔버스 리프라 호출 빈도가 높다.
  const cdnFrames = useMemo(() => (frames ?? []).filter(isCdnKey), [frames]);
  const cdnFrameList = cdnFrames.join('|');

  // width/height 스타일도 size가 그대로면 참조를 유지한다 (<Image>의 style 배열).
  const sizeStyle = useMemo(() => ({ width: size, height: size }), [size]);

  // Warm every frame up front so the first tap swaps without a blank flash
  // (and a revisit works offline from the disk cache).
  useEffect(() => {
    const keys = cdnFrameList ? cdnFrameList.split('|') : [];
    if (keys.length > 1) {
      Image.prefetch?.(
        keys.map((key) => `${RESOURCE_BASE}/${key}`),
        { cachePolicy: 'memory-disk' },
      )?.catch(() => {});
    }
  }, [cdnFrameList]);

  if (cdnFrames.length > 0) {
    const key = cdnFrames[wrapPose(pose, cdnFrames.length)];
    return (
      <Image
        source={assetSource(key)}
        style={[sizeStyle, style]}
        contentFit="contain"
        cachePolicy="memory-disk"
        // 줌 대상에서는 원본 해상도로 — 다운스케일 디코딩은 확대 시 흐려진다.
        allowDownscaling={!sharp}
        accessibilityLabel={character.name}
        testID="cdn-animation"
      />
    );
  }

  const sprites = SPRITES[characterId];
  const source = sprites?.[wrapPose(pose, POSE_COUNT)];

  if (!source) {
    // No frame art for this character yet — a neutral paw mark stands in.
    return (
      <View
        style={[sizeStyle, styles.center, style as StyleProp<ViewStyle>]}
        accessibilityLabel={character.name}>
        <PawPictogram size={size * 0.55} />
      </View>
    );
  }

  return (
    <Image
      source={source}
      style={[sizeStyle, style]}
      contentFit="contain"
      allowDownscaling={!sharp}
      accessibilityLabel={character.name}
    />
  );
});

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
