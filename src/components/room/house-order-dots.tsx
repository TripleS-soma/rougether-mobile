import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { Radius, Spacing } from '@/constants/theme';
import { useConstant, useLatestRef } from '@/hooks/use-stable-value';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';

/** 순서를 바꿀 수 있는 페이지 — 내가 속한 집. */
export type OrderableHouse = { houseId: number; name: string };

export type HouseOrderDotsProps = {
  /** 내 집들 (표시 순서 그대로). 도트 앞쪽을 차지한다. */
  houses: OrderableHouse[];
  /**
   * 뒤에 붙는 **순서 대상이 아닌** 페이지 수 — 승인 대기 잠금 카드(#648).
   * 내 집이 아니라 정렬에서 빼고 항상 끝에 남긴다.
   */
  pendingCount?: number;
  /** 현재 페이지 (전체 페이지 기준 0-base). */
  index: number;
  /**
   * 순서 확정. 원하는 순서의 houseId 배열을 **전량** 넘긴다
   * (`PUT /me/houses/order` 계약). 없으면 정렬 제스처가 붙지 않는다.
   */
  onReorder?: (houseIds: number[]) => void;
};

/**
 * 집 순서 드래그를 여는 꾹 누르기 판정(ms, #820) — 페이저 가로 스와이프를
 * 뺏지 않을 만큼은 길게. 루틴 행 드래그(220ms)보다 긴 이유도 같다: 인디케이터는
 * 탭으로 집을 넘기는 곳이라 짧으면 넘기려다 드래그가 걸린다.
 *
 * 이름에 용도를 담는다 — 예전엔 두 파일이 똑같이 `LONG_PRESS_MS`였고 값이
 * 달랐다(350 vs 220). 같은 이름이면 같은 값인 줄 알기 쉽다.
 */
const HOUSE_REORDER_LONG_PRESS_MS = 350;
/** 펼친 칩 하나의 폭 — 드래그 거리를 칸 수로 환산하는 기준. */
const CHIP_W = 96;

/** from 위치의 원소를 to로 옮긴 새 배열. */
export function movedTo<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(Math.min(Math.max(to, 0), next.length), 0, item);
  return next;
}

/**
 * 집 스위처 아래 페이지 인디케이터 (#820).
 *
 * 평소엔 도트지만 **꾹 누르면 그 자리에서 이름표 줄로 펼쳐지고**, 좌우로
 * 끌어 집 순서를 바꾼다. 도트가 이미 순서 그 자체를 표현하므로 별도 화면
 * 없이 직접 조작하게 한 것이고, 펼쳐서 이름을 보여주는 건 도트만으로는
 * "지금 어느 집을 옮기는지" 알 수 없기 때문이다.
 *
 * 제스처는 `activateAfterLongPress`라 짧은 가로 드래그는 그대로 하단 탭
 * 페이저(#563)에게 간다 — #825에서 통일한 "가로 스와이프 = 탭 이동" 규칙을
 * 깨지 않는다.
 */
export function HouseOrderDots({
  houses,
  pendingCount = 0,
  index,
  onReorder,
}: HouseOrderDotsProps) {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  // 드래그 중 표시용 순서 — null이면 접힌 상태(평소 도트).
  const [draft, setDraft] = useState<{ order: OrderableHouse[]; from: number } | null>(null);

  const total = houses.length + pendingCount;
  const canReorder = !!onReorder && houses.length > 1;

  // 최신 props를 ref로 읽어 제스처를 재생성하지 않는다 (#539 계약).
  const stateRef = useLatestRef({ houses, index, onReorder });
  /**
   * 진행 중인 드래그 세션. **React 상태가 아니라 ref**인 게 핵심이다 —
   * onStart→onUpdate가 한 프레임 안에 연달아 오면 setState가 아직 반영되지
   * 않아, 상태로 읽으면 첫 이동이 통째로 무시된다. 상태(`draft`)는 그리기
   * 전용 거울이고 판정은 항상 이 ref로 한다.
   */
  const session = useRef<{ startIndex: number; to: number } | null>(null);

  const reorder = useConstant(() =>
    Gesture.Pan()
      .withTestId('house-order-drag')
      .runOnJS(true)
      .activateAfterLongPress(HOUSE_REORDER_LONG_PRESS_MS)
      .onStart(() => {
        const { houses: list, index: at } = stateRef.current;
        if (list.length < 2) return;
        // 대기 페이지 위에서 시작하면 잡을 집이 없다 — 마지막 집으로 클램프.
        const startIndex = Math.min(Math.max(at, 0), list.length - 1);
        session.current = { startIndex, to: startIndex };
        setDraft({ order: list, from: startIndex });
      })
      .onUpdate((e) => {
        const s = session.current;
        if (!s) return;
        const list = stateRef.current.houses;
        const shift = Math.round(e.translationX / CHIP_W);
        const to = Math.min(Math.max(s.startIndex + shift, 0), list.length - 1);
        if (to === s.to) return;
        s.to = to;
        setDraft({ order: movedTo(list, s.startIndex, to), from: to });
      })
      .onFinalize(() => {
        const s = session.current;
        session.current = null;
        setDraft(null);
        if (!s || s.to === s.startIndex) return;
        const after = movedTo(stateRef.current.houses, s.startIndex, s.to).map((h) => h.houseId);
        stateRef.current.onReorder?.(after);
      }),
  );

  const dots = (
    <View style={styles.dots}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={houses[i]?.houseId ?? `page-${i}`}
          style={[
            styles.dot,
            i === index
              ? { width: 20, backgroundColor: t.primary }
              : { width: 6, backgroundColor: t.surface },
          ]}
        />
      ))}
    </View>
  );

  const expanded = draft ? (
    <View style={styles.chips}>
      {draft.order.map((h, i) => (
        <View
          key={h.houseId}
          style={[
            styles.chip,
            {
              backgroundColor: i === draft.from ? t.primary : t.surface,
              borderColor: i === draft.from ? t.primary : t.border,
            },
          ]}>
          <Text
            numberOfLines={1}
            style={[
              Typography.supporting,
              emph(i === draft.from ? 'bold' : 'normal'),
              { color: i === draft.from ? t.onPrimary : t.text },
            ]}>
            {h.name}
          </Text>
        </View>
      ))}
    </View>
  ) : null;

  const body = (
    // 도트만으로는 터치 영역이 6px이라 잡을 수가 없다 — 행 높이로 확보한다.
    <View
      style={styles.row}
      accessibilityLabel={canReorder ? '집 순서 — 꾹 눌러 좌우로 끌면 순서가 바뀌어요' : undefined}
      // collapsable={false}: 안드로이드 뷰 평탄화로 사라지면 제스처가 붙을
      // 대상이 없어진다 (친구 방 플링과 같은 규칙).
      collapsable={false}>
      {expanded ?? dots}
    </View>
  );

  if (!canReorder) return body;
  return <GestureDetector gesture={reorder}>{body}</GestureDetector>;
}

const styles = StyleSheet.create({
  row: {
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: Spacing.one,
    alignItems: 'center',
  },
  dot: {
    height: 6,
    borderRadius: Radius.pill,
  },
  chips: {
    flexDirection: 'row',
    gap: Spacing.one,
    alignItems: 'center',
  },
  chip: {
    maxWidth: CHIP_W,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
});
