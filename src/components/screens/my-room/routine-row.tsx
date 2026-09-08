import { memo, useCallback, useMemo } from 'react';
import {
  Animated,
  type GestureResponderEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { SwipeDeleteRow } from '@/components/screens/my-room/swipe-delete-row';
import { BearCheck } from '@/components/ui/bear-check';
import { Icon } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import { useLatestRef } from '@/hooks/use-stable-value';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { formatTime } from '@/utils/datetime';

/** 롱프레스 후 드래그 활성까지 (#716) — 그 전 세로 스크롤은 ScrollView 몫. */
/** 루틴 행 드래그를 여는 꾹 누름. 집 순서(350ms)보다 짧다 — 행은 탭 동작이
 *  체크뿐이라 빨리 잡혀도 오작동이 적다. */
const ROUTINE_DRAG_LONG_PRESS_MS = 220;

export type RoutineRowProps = {
  /** 행 식별자 — 부모의 핸들러 디스패치 키이자 드래그 대상 키. */
  rowKey: string;
  title: string;
  done: boolean;
  /** 알림/마감 시각 — 있으면 종 배지. */
  time?: string;
  /** 반복 루틴 — 제목 뒤 은은한 ↻ 마커로 1회성 투두와 구분 (#576). */
  repeats?: boolean;
  /** 카테고리 색 — 체크 색. */
  color: string;
  /** 롱프레스 재정렬 대상인가 (방 탭의 미완료 행만). */
  draggable: boolean;
  /** 지금 들려 있는 행인가. */
  active: boolean;
  /** 들린 행이 손가락을 따라가는 오프셋 — 부모 소유(한 번에 하나만 들린다). */
  dragTY: Animated.Value;
  /** 기록만 남은(삭제된) 항목은 메뉴가 열리지 않는다. */
  menuEnabled: boolean;
  /** 스와이프 삭제 (#566) — 서버 기반 달력 항목 등은 비활성. */
  deleteEnabled: boolean;

  // --- 아래는 전부 참조 고정 계약 (#769). 부모가 useStableCallback으로 준다. ---
  onToggle: (rowKey: string, e?: GestureResponderEvent) => void;
  onMenu: (rowKey: string) => void;
  onDelete: (rowKey: string) => void;
  onDragStart: (rowKey: string) => void;
  onDragUpdate: (rowKey: string, absoluteY: number) => void;
  onDragEnd: (rowKey: string) => void;
  onDragFinalize: (rowKey: string) => void;
  registerRef: (rowKey: string, node: View | null) => void;
};

/**
 * 나의 방 루틴/할 일 한 줄 (#769에서 렌더 함수 → memo 컴포넌트로 승격).
 *
 * 승격 전에는 화면 본문의 `renderRoutineRow(...)` 호출이라 memo 경계가 아예
 * 존재할 수 없었고, 퀵애드 입력 한 글자마다 전 행의 `SwipeDeleteRow`
 * (ReanimatedSwipeable) 트리가 재조정됐다. 더 나쁜 건 팬 제스처가 렌더 본문에서
 * 매번 새로 만들어진 것 — 이 저장소가 여러 곳에 "제스처는 마운트 시 1회 생성,
 * 재생성은 활성 팬을 취소시킨다"고 못 박아 둔 계약(tab-pager·draggable-furniture·
 * paw-refresh-scroll)을 여기만 어기고 있었다. 드래그 도중 `setDragId` 리렌더가
 * 전 행의 제스처를 갈아치우니 성능 문제이기 이전에 재정렬이 튈 위험이었다.
 *
 * 그래서 콜백은 전부 **부모가 참조 고정해 rowKey로 디스패치**하는 형태로 받고,
 * 제스처는 `draggable` 플래그가 바뀔 때만 다시 만들고 최신 핸들러는 ref로 읽는다.
 *
 * 트리 모양은 항상 같다 (#1207) — `GestureDetector > Animated.View > SwipeDeleteRow`.
 * 예전엔 `draggable`이 꺼진 행(완료·달력)은 GestureDetector 없이 맨 SwipeDeleteRow를
 * 루트로 그렸는데, 완료 토글마다 루트 타입이 바뀌어 행이 언마운트→재마운트됐다.
 * iOS/Fabric은 뷰를 재활용하면서 RNGH가 찍어 둔 reactTag·리코그나이저를 지우지 않아,
 * 재활용된 뷰가 A행의 리코그나이저를 들고 B행을 그리는 순간 **B를 밀었는데 A가
 * 밀리는** 버그가 났다. 드래그 on/off는 `.enabled(draggable)`로만 다룬다.
 */
function RoutineRowBase({
  rowKey,
  title,
  done,
  time,
  repeats,
  color,
  draggable,
  active,
  dragTY,
  menuEnabled,
  deleteEnabled,
  onToggle,
  onMenu,
  onDelete,
  onDragStart,
  onDragUpdate,
  onDragEnd,
  onDragFinalize,
  registerRef,
}: RoutineRowProps) {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();

  // 제스처는 draggable이 바뀔 때만 재생성 — 콜백을 클로저로 굳히면 안 된다,
  // 최신값을 ref로 읽는다. draggable은 드래그 도중 바뀌지 않으니(완료 토글은
  // 드래그와 배타) 재생성이 활성 팬을 취소시킬 일은 없다. 꺼진 제스처는 네이티브
  // 핸들러가 비활성이라 탭·스와이프를 삼키지 않는다 — GestureDetector는 그대로.
  const handlers = useLatestRef({ onDragStart, onDragUpdate, onDragEnd, onDragFinalize });
  const keyRef = useLatestRef(rowKey);
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .withTestId(`routine-drag-${rowKey}`)
        .enabled(draggable)
        .activateAfterLongPress(ROUTINE_DRAG_LONG_PRESS_MS)
        // runOnJS: 측정(measureInWindow)·Animated를 그대로 쓰기 위해 (#716).
        .runOnJS(true)
        .onStart(() => handlers.current.onDragStart(keyRef.current))
        .onUpdate((e) => {
          dragTY.setValue(e.translationY);
          handlers.current.onDragUpdate(keyRef.current, e.absoluteY);
        })
        .onEnd(() => handlers.current.onDragEnd(keyRef.current))
        .onFinalize(() => handlers.current.onDragFinalize(keyRef.current)),
    [draggable, dragTY, handlers, keyRef, rowKey],
  );

  // 드래그 슬롯 측정용 ref는 드래그 가능한 행만 등록한다 — 예전엔 GestureDetector
  // 자체가 없어 등록이 안 됐던 행(완료·달력)이 슬롯에 끼지 않게 같은 범위를 지킨다.
  // draggable이 바뀌면 React가 옛 콜백을 null로 부른 뒤 새 콜백을 노드로 부른다.
  const setRef = useCallback(
    (node: unknown) => registerRef(rowKey, draggable ? ((node as View | null) ?? null) : null),
    [registerRef, rowKey, draggable],
  );
  const toggle = useCallback(
    (e?: GestureResponderEvent) => onToggle(rowKey, e),
    [onToggle, rowKey],
  );
  const openMenu = useCallback(() => onMenu(rowKey), [onMenu, rowKey]);
  const remove = useCallback(() => onDelete(rowKey), [onDelete, rowKey]);

  const body = (
    <SwipeDeleteRow label={title} onDelete={deleteEnabled ? remove : undefined}>
      <View style={styles.routineRow}>
        {/* 체크만 완료를 토글하고, 나머지 영역은 수정/삭제 시트를 연다. */}
        <BearCheck checked={done} color={color} onPress={toggle} accessibilityLabel={title} />
        <Pressable
          onPress={menuEnabled ? openMenu : undefined}
          accessibilityRole="button"
          accessibilityLabel={`${title} 메뉴`}
          style={[styles.flex, styles.rowBody]}>
          {/* 반복 마커(#576)는 제목과 같은 줄 — 아랫줄(알림 배지)에 두면
              시간까지 겹쳐 부제 줄이 길어진다. 긴 제목은 마커가 밀리지 않게
              한 줄로 잘라낸다. */}
          <View style={styles.titleRow}>
            <Text
              numberOfLines={1}
              style={[
                Typography.body,
                styles.titleText,
                done
                  ? { color: t.textMuted, textDecorationLine: 'line-through' }
                  : { color: t.text },
              ]}>
              {title}
            </Text>
            {repeats ? (
              <View testID="repeat-marker">
                <Icon name="refresh" size={12} color={t.textDisabled} />
              </View>
            ) : null}
          </View>
          {time ? (
            <View style={styles.badges}>
              <View style={styles.badge}>
                <Icon name="bell" size={12} color={t.textMuted} />
                <Text style={[styles.badgeText, emph('normal'), { color: t.textMuted }]}>
                  {formatTime(time)}
                </Text>
              </View>
            </View>
          ) : null}
        </Pressable>
      </View>
    </SwipeDeleteRow>
  );

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        ref={setRef}
        testID={`routine-row-${rowKey}`}
        style={
          active
            ? { transform: [{ translateY: dragTY }], zIndex: 20, elevation: 8, opacity: 0.96 }
            : undefined
        }>
        {body}
      </Animated.View>
    </GestureDetector>
  );
}

export const RoutineRow = memo(RoutineRowBase);

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  routineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    // 부제 줄(알림) 있는 행 높이(≈48)에 맞춘 고정 리듬 (#392) — 부제 없는
    // 행에서 곰 체크(귀 포함 ~30px)가 행을 꽉 채우지 않게 한다.
    minHeight: 48,
  },
  rowBody: {
    paddingVertical: Spacing.one,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  titleText: {
    flexShrink: 1,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.half,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
  },
  badgeText: {
    fontSize: 13,
  },
});
