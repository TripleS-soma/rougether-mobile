import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import { PrimaryButton, TextButton } from '@/components/screens/onboarding/onboarding-buttons';
import { Radius, ShadowColor, Spacing } from '@/constants/theme';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useScreenStyle } from '@/hooks/use-screen-style';
import { useConstant, useLatestRef } from '@/hooks/use-stable-value';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { horizontalFlingGesture } from '@/utils/gesture';

export type IntroSlide = { id: string; image: number; title: string; description: string };

/**
 * 소개 5장 (#412, design-sync A안). 비주얼은 실제 앱 화면 캡처(라이트, 1080×2192)를
 * 표시 3배수인 689×1400 WebP로 줄인 것이다(#746 → #1282 재촬영). UI가 크게 바뀌면
 * 다시 찍어 교체한다 — 캡처 비율이 바뀌면 styles.captureFrame도 함께.
 *
 * `id`는 계측(`intro_view`의 step)에 쓰는 이름이라 순서를 바꿔도 유지한다.
 */
export const INTRO_SLIDES: IntroSlide[] = [
  {
    id: 'my-room',
    image: require('@/assets/images/onboarding/my-room.webp'),
    title: '매일의 루틴이\n포근한 방이 되는 곳',
    description: '루게더에 오신 걸 환영해요',
  },
  {
    id: 'routines',
    image: require('@/assets/images/onboarding/routines.webp'),
    title: '오늘의 루틴을\n곰 체크로 완료해요',
    description: '카테고리로 모아 보고, 알림·반복 설정까지',
  },
  {
    id: 'decor',
    image: require('@/assets/images/onboarding/decor.webp'),
    title: '모은 보상으로\n내 방을 꾸며요',
    description: '가구·벽지·바닥을 원하는 자리에 자유 배치',
  },
  {
    id: 'house',
    image: require('@/assets/images/onboarding/house.webp'),
    title: '친구들과 한 집에서\n함께 자라요',
    description: '방 구경 · 응원 보내기 · 공동 미션으로 집 레벨 업',
  },
  {
    id: 'calendar',
    image: require('@/assets/images/onboarding/calendar.webp'),
    title: '기록은 달력으로,\n보상은 뽑기로',
    description: '지난 완료를 돌아보고 캐릭터·가구를 모아요',
  },
];

/**
 * 공용 상한보다 좁게 묶는다 (#725) — 폰 목업이 가운데 서는 레이아웃이라 넓으면 허전하다.
 */
const CONTENT_MAX_W = 480;

export type IntroScreenProps = {
  /** 마지막 장 CTA — 로그인 전이면 로그인 화면으로, 다시 보기면 목표 선택으로. */
  onDone?: () => void;
  /** 마지막 장 CTA 라벨. */
  doneLabel?: string;
  /**
   * 첫 장의 '이미 계정이 있어요' (#1282) — 앱을 다시 설치한 기존 사용자가 다섯 장을
   * 넘기지 않고 로그인으로 가는 출구. 넘기지 않으면 버튼도 없다.
   */
  onHaveAccount?: () => void;
  /**
   * 오른쪽 위 '건너뛰기' — 설정 → 튜토리얼 다시 보기 전용 (#1023). 마지막 장에서는
   * CTA가 그 역할을 하므로 숨긴다. 넘기지 않으면 버튼도 없다.
   */
  onSkip?: () => void;
  /** 장에 들어갈 때마다(뒤로 돌아온 경우 포함) — 계측용. */
  onSlideView?: (slideId: string, index: number) => void;
};

/**
 * 앱 소개 슬라이드 (#1282). 예전엔 로그인 뒤 온보딩의 첫 부분이었는데, 설치 후
 * 로그인 전에 46%가 떠나는 걸 보고(#1045) 로그인 전에 앱의 가치를 먼저 보여 주도록
 * 떼어냈다. 로그인 라우트가 첫 진입에 그리고, 다시 보기는 온보딩이 그린다.
 */
export function IntroScreen({
  onDone,
  doneLabel = '시작하기',
  onHaveAccount,
  onSkip,
  onSlideView,
}: IntroScreenProps) {
  const t = useTokens();
  const Typography = useTypography();
  // Pinned bottom action buttons → pad both edges so the notch / home indicator
  // don't clip the top title or the bottom buttons.
  const screenStyle = useScreenStyle(['top', 'bottom']);
  // 넓은 화면(태블릿·웹 데스크톱)에서 건너뛰기 줄·본문·도트·버튼을 같은 중앙 컬럼에 세운다.
  const column = useResponsiveColumn(CONTENT_MAX_W);
  const [index, setIndex] = useState(0);
  const isLast = index === INTRO_SLIDES.length - 1;
  const slide = INTRO_SLIDES[index];

  // 최신 콜백은 ref로 읽는다 — 부모가 매 렌더 새 함수를 넘겨도 같은 장에서 다시 쏘지 않게.
  const onSlideViewRef = useLatestRef(onSlideView);
  useEffect(() => {
    onSlideViewRef.current?.(INTRO_SLIDES[index].id, index);
  }, [index, onSlideViewRef]);

  /**
   * 좌우 스와이프 (#825). 앱의 나머지 제스처가 전부 RNGH라 같은 유틸로 통일한다:
   * 활성 ±24, 세로 실패 ±36이라 세로 스크롤을 뺏지 않는다. 최신 핸들러는 ref로
   * 읽어 제스처를 재생성하지 않는다(#539 계약) — 재생성은 진행 중인 팬을 취소시킨다.
   */
  const slideFlingRef = useLatestRef((dir: 'left' | 'right') => {
    if (dir === 'left') {
      if (isLast) onDone?.();
      else setIndex((i) => i + 1);
      return;
    }
    setIndex((i) => Math.max(0, i - 1));
  });
  const slideFling = useConstant(() =>
    horizontalFlingGesture('onboarding-slide-fling', (dir) => slideFlingRef.current(dir)),
  );

  return (
    <View style={[styles.screen, screenStyle]}>
      {/* 빈 줄은 남겨 두 경로(건너뛰기 있음·없음)의 레이아웃을 맞춘다. */}
      <View style={[styles.skipRow, column]}>
        {onSkip && !isLast ? (
          <Pressable
            onPress={onSkip}
            accessibilityRole="button"
            accessibilityLabel="튜토리얼 건너뛰고 나가기"
            hitSlop={8}>
            <Text style={[Typography.supporting, { color: t.textMuted }]}>건너뛰기</Text>
          </Pressable>
        ) : null}
      </View>

      {/* 태블릿·짧은 캔버스 대응 (#725): 세로가 부족하면 가운데 정렬 대신 스크롤로
          흘려 제목이 위로 잘리지 않게 하고, 넓은 폭에서는 중앙 고정폭 컬럼으로 묶는다. */}
      <ScrollView
        style={styles.slideScroll}
        contentContainerStyle={styles.slideBody}
        showsVerticalScrollIndicator={false}>
        {/* collapsable={false}: 안드로이드 뷰 평탄화로 사라지면 제스처가
            붙을 대상이 없어진다 (친구 방 플링과 같은 규칙). */}
        <GestureDetector gesture={slideFling}>
          <View style={[styles.slideContent, column]} collapsable={false}>
            <Text style={[Typography.h2, styles.center, { color: t.text }]}>{slide.title}</Text>
            <Text style={[Typography.body, styles.center, { color: t.textMuted }]}>
              {slide.description}
            </Text>
            {/* 실제 앱 화면 캡처 — 폰 프레임 카드 (#412). */}
            <View
              style={[styles.captureFrame, { borderColor: t.border, backgroundColor: t.surface }]}>
              <Image
                source={slide.image}
                style={styles.captureImage}
                contentFit="cover"
                transition={150}
                accessibilityLabel={slide.title.replace('\n', ' ')}
              />
            </View>
          </View>
        </GestureDetector>
      </ScrollView>

      <View style={[styles.dots, column]}>
        {INTRO_SLIDES.map((s, i) => (
          <Pressable
            key={s.id}
            onPress={() => setIndex(i)}
            accessibilityRole="button"
            accessibilityLabel={`${i + 1}번째 슬라이드로 이동`}
            style={[
              styles.dot,
              i === index
                ? { width: 24, backgroundColor: t.primary }
                : { width: 8, backgroundColor: t.border },
            ]}
          />
        ))}
      </View>

      <View style={[styles.actions, column]}>
        <PrimaryButton
          label={isLast ? doneLabel : '다음'}
          onPress={() => (isLast ? onDone?.() : setIndex((i) => i + 1))}
        />
        {index === 0 && onHaveAccount ? (
          <TextButton label="이미 계정이 있어요" onPress={onHaveAccount} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  center: {
    textAlign: 'center',
  },
  skipRow: {
    height: 44,
    paddingHorizontal: Spacing.four,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  slideScroll: {
    flex: 1,
  },
  // contentContainer — 내용이 짧으면 가운데(flexGrow+center), 넘치면 스크롤.
  slideBody: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
  },
  slideContent: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  captureFrame: {
    // 캡처 원본(1080×2192) 비율의 폰 프레임 카드 — 세로 공간에 맞춰 줄어든다.
    // 비율이 어긋나면 contentFit="cover"가 화면 가장자리를 잘라내므로 원본과
    // 같은 값을 쓴다 (#746).
    width: 210,
    aspectRatio: 1080 / 2192,
    maxHeight: 460,
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    alignSelf: 'center',
    marginTop: Spacing.two,
    elevation: 3,
    shadowColor: ShadowColor,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  captureImage: {
    width: '100%',
    height: '100%',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
  dot: {
    height: 8,
    borderRadius: Radius.pill,
  },
  actions: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
});
