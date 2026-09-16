import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';

import { Overlay, Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

/** 화면(윈도) 좌표계의 대상 사각형. */
export type TargetRect = { x: number; y: number; w: number; h: number };

type TargetStore = {
  rects: Record<string, TargetRect>;
  setRect: (key: string, rect: TargetRect) => void;
  /** 대상별 재측정 함수 등록 — 해제 함수를 돌려준다. */
  registerMeasure: (key: string, measure: () => void) => () => void;
  /** 등록된 대상 전부를 다시 잰다. */
  remeasureAll: () => void;
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
  const measuresRef = useRef(new Map<string, () => void>());
  const registerMeasure = useCallback((key: string, measure: () => void) => {
    measuresRef.current.set(key, measure);
    return () => {
      if (measuresRef.current.get(key) === measure) measuresRef.current.delete(key);
    };
  }, []);
  const remeasureAll = useCallback(() => {
    measuresRef.current.forEach((measure) => measure());
  }, []);
  const value = useMemo(
    () => ({ rects, setRect, registerMeasure, remeasureAll }),
    [rects, setRect, registerMeasure, remeasureAll],
  );
  return <CoachTargetContext.Provider value={value}>{children}</CoachTargetContext.Provider>;
}

/**
 * 스포트라이트 대상 래퍼 — 레이아웃 때마다 윈도 좌표를 측정해 등록한다.
 * 표시에는 관여하지 않는 투명 래퍼라 화면 순수성(prop 기반)을 해치지 않는다.
 */
/** 등록된 대상 좌표 — 오버레이를 그리는 쪽이 읽는다. 프로바이더 밖이면 빈 맵. */
export function useCoachTargets(): Record<string, TargetRect> {
  const store = useContext(CoachTargetContext);
  return store?.rects ?? EMPTY_RECTS;
}
const EMPTY_RECTS: Record<string, TargetRect> = {};

/**
 * 오버레이가 떠 있는 동안 대상 좌표를 주기적으로 다시 잰다 (2026-09-16, iOS·Android 위치 어긋남).
 * `onLayout`은 **자기 크기·부모 안 위치가 바뀔 때만** 불린다 — 스크롤, 탭 페이저 이동(부모
 * transform), 배너 등장으로 인한 창 기준 위치 변화에는 안 불려 좌표가 낡는다.
 */
const REMEASURE_MS = 250;

export function CoachTarget({ id, children }: { id: string; children: ReactNode }) {
  const store = useContext(CoachTargetContext);
  const ref = useRef<View>(null);
  const setRect = store?.setRect;
  const measure = useCallback(() => {
    ref.current?.measureInWindow((x, y, w, h) => {
      if (setRect && w > 0 && h > 0) setRect(id, { x, y, w, h });
    });
  }, [id, setRect]);
  const registerMeasure = store?.registerMeasure;
  useEffect(() => registerMeasure?.(id, measure), [registerMeasure, id, measure]);
  return (
    <View ref={ref} collapsable={false} onLayout={measure}>
      {children}
    </View>
  );
}

export type CoachStep = {
  /** 스포트라이트 대상 — 하나. `targets`와 함께 주면 합집합. */
  target?: string;
  /** 대상 여러 개 — 구멍은 전부를 감싸는 사각형(#1324 꾸미기: 격자 + 적용하기). */
  targets?: string[];
  title: string;
  body: string;
};

export type CoachMarkOverlayProps = {
  steps: CoachStep[];
  index: number;
  onNext?: () => void;
  onSkip?: () => void;
  targets: Record<string, TargetRect>;
  /** 셸 프레임 크기(onLayout) — 말풍선 배치·구멍 클램프용. */
  frame: { w: number; h: number };
  /**
   * 완전 잠금 (#1324) — 건너뛰기·다음 버튼 없이 대상만 눌리고, 안드로이드 뒤로가기도
   * 삼킨다. 진행은 오버레이가 아니라 호출자(미션 상태)가 대상 동작을 보고 바꾼다.
   */
  hardLock?: boolean;
  /** 말풍선 위 작은 라벨 — 예: '미션 1/4'. */
  caption?: string;
};

const HOLE_PAD = 6;
/** 말풍선 최대 폭 — 웹 2단(1200px) 프레임에서 카드가 화면 전체로 늘지 않게. */
const BUBBLE_MAX_W = 420;
const BUBBLE_MARGIN = Spacing.four;

/**
 * 창 좌표 → 오버레이 좌표 (2026-09-16 데스크톱 보고). 대상은 `measureInWindow`로 **창 기준**
 * 좌표를 등록하는데, 오버레이는 셸 안(웹 데스크톱에선 가운데 앱 프레임 안)에 그려진다.
 * 프레임 여백만큼 원점이 어긋나 구멍·링이 대상 오른쪽으로 밀렸다 — 네이티브·좁은 웹은
 * 원점이 (0,0)이라 드러나지 않았다. 오버레이 자신의 창 원점을 빼서 맞춘다.
 */
export function toOverlayRect(rect: TargetRect, origin: { x: number; y: number }): TargetRect {
  return { x: rect.x - origin.x, y: rect.y - origin.y, w: rect.w, h: rect.h };
}

/**
 * 말풍선 가로 배치 — 프레임이 넓으면 최대 폭으로 줄이고 구멍 가운데 아래(위)에 둔다.
 * 좁은 화면(폭 − 여백 ≤ 최대 폭)은 종전처럼 좌우 여백만 두고 꽉 채운다.
 */
export function bubbleHorizontal(
  frameW: number,
  holeCenterX: number | null,
): { left: number; width: number } {
  const width = Math.min(frameW - BUBBLE_MARGIN * 2, BUBBLE_MAX_W);
  const center = holeCenterX ?? frameW / 2;
  const left = Math.min(
    Math.max(center - width / 2, BUBBLE_MARGIN),
    frameW - width - BUBBLE_MARGIN,
  );
  return { left, width };
}

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
  hardLock = false,
  caption,
}: CoachMarkOverlayProps) {
  const t = useTokens();
  const tr = useT();
  const Typography = useTypography();
  const step = steps[index];
  const rootRef = useRef<View>(null);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const measureOrigin = useCallback(() => {
    rootRef.current?.measureInWindow((x, y) => {
      setOrigin((prev) => (Math.abs(prev.x - x) < 1 && Math.abs(prev.y - y) < 1 ? prev : { x, y }));
    });
  }, []);
  const remeasureAll = useContext(CoachTargetContext)?.remeasureAll;
  const visible = step != null;
  useEffect(() => {
    if (!visible) return;
    const tick = () => {
      measureOrigin();
      remeasureAll?.();
    };
    tick();
    const timer = setInterval(tick, REMEASURE_MS);
    return () => clearInterval(timer);
  }, [visible, measureOrigin, remeasureAll]);
  // 완전 잠금 중엔 안드로이드 뒤로가기도 오버레이가 먹는다 — 밑 화면의 백 핸들러가
  // 코치마크를 두고 화면을 바꾸면 대상이 사라진다.
  useEffect(() => {
    if (!hardLock || !step) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [hardLock, step]);
  if (!step) return null;
  // 셸 onLayout 전(또는 테스트 환경)엔 관례적 폰 크기로 그린다 — 곧 보정됨.
  const frameW = frame.w || 360;
  const frameH = frame.h || 800;
  const rect = unionRect(
    [step.target, ...(step.targets ?? [])]
      .map((id) => (id ? targets[id] : undefined))
      .filter((r): r is TargetRect => !!r)
      .map((r) => toOverlayRect(r, origin)),
  );

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

  const bubbleX = bubbleHorizontal(frameW, hole ? hole.x + hole.w / 2 : null);

  const dim = Overlay.spotlight;
  const last = index === steps.length - 1;

  return (
    <View
      ref={rootRef}
      onLayout={measureOrigin}
      style={[StyleSheet.absoluteFill, styles.root]}
      pointerEvents="auto"
      testID="coach-overlay">
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
          { backgroundColor: t.screen, left: bubbleX.left, width: bubbleX.width },
          bubbleTop != null ? { top: bubbleTop } : null,
          bubbleBottom != null ? { bottom: bubbleBottom } : null,
        ]}>
        {caption ? (
          <Text style={[Typography.supporting, { color: t.primaryText }]}>{caption}</Text>
        ) : null}
        <Text style={[Typography.h3, { color: t.text }]}>{step.title}</Text>
        <Text style={[Typography.body, styles.bubbleBody, { color: t.textMuted }]}>
          {step.body}
        </Text>
        {hardLock ? null : (
          <View style={styles.bubbleRow}>
            <Pressable
              onPress={onSkip}
              accessibilityRole="button"
              accessibilityLabel={tr('member.tutorial.skipA11y')}
              hitSlop={8}>
              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                {tr('member.common.skip')}
              </Text>
            </Pressable>
            <Text style={[Typography.supporting, { color: t.textDisabled }]}>
              {index + 1} / {steps.length}
            </Text>
            <Pressable
              onPress={onNext}
              accessibilityRole="button"
              accessibilityLabel={
                last ? tr('member.tutorial.finishA11y') : tr('member.tutorial.nextA11y')
              }
              style={[styles.nextBtn, { backgroundColor: t.primary }]}>
              <Text style={[Typography.label, { color: t.onPrimary }]}>
                {last ? tr('member.common.start') : tr('member.common.next')}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

/** 여러 대상을 감싸는 최소 사각형 — 하나면 그대로, 없으면 null. */
function unionRect(rects: TargetRect[]): TargetRect | null {
  if (rects.length === 0) return null;
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.w));
  const bottom = Math.max(...rects.map((r) => r.y + r.h));
  return { x, y, w: right - x, h: bottom - y };
}

const styles = StyleSheet.create({
  // 셸 마지막 자식으로 두되 미션 배너(50)·하단 바보다 위 — Modal 위는 못 덮는다(네이티브 창).
  root: {
    zIndex: 60,
    elevation: 60,
  },
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
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  bubbleBody: {
    lineHeight: 24,
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
