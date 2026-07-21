import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';

/** 화면(윈도) 좌표계의 대상 사각형. */
export type TargetRect = { x: number; y: number; w: number; h: number };

type TargetStore = {
  rects: Record<string, TargetRect>;
  setRect: (key: string, rect: TargetRect) => void;
};

const CoachTargetContext = createContext<TargetStore | null>(null);

/**
 * 코치마크 대상 좌표 저장소 (#351). 앱 셸 최상단에 한 번 감싸고,
 * 스포트라이트로 짚을 요소를 <CoachTarget id="…">로 감싼다.
 */
export function CoachTargetProvider({ children }: { children: ReactNode }) {
  const [rects, setRects] = useState<Record<string, TargetRect>>({});
  const setRect = useCallback((key: string, rect: TargetRect) => {
    setRects((prev) => {
      const old = prev[key];
      // 서브픽셀 흔들림으로 무한 갱신되지 않게 1px 미만 변화는 무시.
      if (
        old &&
        Math.abs(old.x - rect.x) < 1 &&
        Math.abs(old.y - rect.y) < 1 &&
        Math.abs(old.w - rect.w) < 1 &&
        Math.abs(old.h - rect.h) < 1
      ) {
        return prev;
      }
      return { ...prev, [key]: rect };
    });
  }, []);
  const value = useMemo(() => ({ rects, setRect }), [rects, setRect]);
  return <CoachTargetContext.Provider value={value}>{children}</CoachTargetContext.Provider>;
}

export function useCoachTargets(): Record<string, TargetRect> {
  return useContext(CoachTargetContext)?.rects ?? {};
}

/**
 * 스포트라이트 대상 래퍼 — 레이아웃 때마다 윈도 좌표를 측정해 등록한다.
 * 표시에는 관여하지 않는 투명 래퍼라 화면 순수성(prop 기반)을 해치지 않는다.
 */
export function CoachTarget({ id, children }: { id: string; children: ReactNode }) {
  const store = useContext(CoachTargetContext);
  const ref = useRef<View>(null);
  const measure = () => {
    ref.current?.measureInWindow((x, y, w, h) => {
      if (store && w > 0 && h > 0) store.setRect(id, { x, y, w, h });
    });
  };
  return (
    <View ref={ref} collapsable={false} onLayout={measure}>
      {children}
    </View>
  );
}

export type CoachStep = {
  /** CoachTarget id — 좌표가 없으면 중앙 말풍선 폴백. */
  target?: string;
  title: string;
  body: string;
};

export type CoachMarkOverlayProps = {
  steps: CoachStep[];
  /** 현재 단계 (0-base). */
  index: number;
  onNext: () => void;
  onSkip: () => void;
  /** 대상 좌표 맵 — useCoachTargets(). */
  targets: Record<string, TargetRect>;
  /** 오버레이가 덮는 화면 크기 (onLayout으로 셸이 넘긴다). */
  frame: { w: number; h: number };
};

const HOLE_PAD = 6;

/**
 * 스포트라이트 오버레이 (#351) — 대상 사각형만 남기고 4분할 딤을 깔고,
 * 하이라이트 링과 말풍선(다음/건너뛰기 + n/N)을 붙인다. 마지막 단계의
 * 다음 버튼은 '시작하기'로 끝난다.
 */
export function CoachMarkOverlay({
  steps,
  index,
  onNext,
  onSkip,
  targets,
  frame,
}: CoachMarkOverlayProps) {
  const t = useTokens();
  const step = steps[index];
  if (!step) return null;
  // 셸 onLayout 전(또는 테스트 환경)엔 관례적 폰 크기로 그린다 — 곧 보정됨.
  const frameW = frame.w || 360;
  const frameH = frame.h || 800;
  const rect = step.target ? targets[step.target] : undefined;

  const hole = rect
    ? {
        x: Math.max(0, rect.x - HOLE_PAD),
        y: Math.max(0, rect.y - HOLE_PAD),
        w: Math.min(frameW, rect.w + HOLE_PAD * 2),
        h: rect.h + HOLE_PAD * 2,
      }
    : null;

  // 말풍선은 구멍 아래 공간이 부족하면 위로 붙인다.
  const bubbleBelow = !hole || hole.y + hole.h + 180 < frameH;
  const bubbleTop = hole ? (bubbleBelow ? hole.y + hole.h + 14 : undefined) : frameH * 0.4;
  const bubbleBottom = hole && !bubbleBelow ? frameH - hole.y + 14 : undefined;

  const dim = `rgba(0,0,0,0.62)`;
  const last = index === steps.length - 1;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="auto" testID="coach-overlay">
      {hole ? (
        <>
          {/* 4분할 딤 — 구멍 부분만 원래 화면이 보인다. */}
          <View
            style={[
              styles.dim,
              { backgroundColor: dim, left: 0, top: 0, right: 0, height: hole.y },
            ]}
          />
          <View
            style={[
              styles.dim,
              { backgroundColor: dim, left: 0, top: hole.y, width: hole.x, height: hole.h },
            ]}
          />
          <View
            style={[
              styles.dim,
              {
                backgroundColor: dim,
                left: hole.x + hole.w,
                right: 0,
                top: hole.y,
                height: hole.h,
              },
            ]}
          />
          <View
            style={[
              styles.dim,
              { backgroundColor: dim, left: 0, right: 0, top: hole.y + hole.h, bottom: 0 },
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.ring,
              { left: hole.x, top: hole.y, width: hole.w, height: hole.h, borderColor: t.warning },
            ]}
          />
        </>
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: dim }]} />
      )}

      <View
        style={[
          styles.bubble,
          { backgroundColor: t.screen },
          bubbleTop != null ? { top: bubbleTop } : null,
          bubbleBottom != null ? { bottom: bubbleBottom } : null,
        ]}>
        <Text style={[Typography.h3, { color: t.text }]}>{step.title}</Text>
        <Text style={[Typography.body, styles.bubbleBody, { color: t.textMuted }]}>
          {step.body}
        </Text>
        <View style={styles.bubbleRow}>
          <Pressable
            onPress={onSkip}
            accessibilityRole="button"
            accessibilityLabel="튜토리얼 건너뛰기"
            hitSlop={8}>
            <Text style={[Typography.supporting, { color: t.textMuted }]}>건너뛰기</Text>
          </Pressable>
          <Text style={[Typography.supporting, { color: t.textDisabled }]}>
            {index + 1} / {steps.length}
          </Text>
          <Pressable
            onPress={onNext}
            accessibilityRole="button"
            accessibilityLabel={last ? '튜토리얼 마치기' : '다음 단계'}
            style={[styles.nextBtn, { backgroundColor: t.primary }]}>
            <Text style={[Typography.label, { color: t.onPrimary }]}>
              {last ? '시작하기' : '다음'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: {
    position: 'absolute',
  },
  ring: {
    position: 'absolute',
    borderWidth: 3,
    borderRadius: Radius.md,
  },
  bubble: {
    position: 'absolute',
    left: Spacing.four,
    right: Spacing.four,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  bubbleBody: {
    lineHeight: 22,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
  },
  nextBtn: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
});
