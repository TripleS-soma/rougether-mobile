import { track } from '@/lib/analytics';
import { recordGesture } from '@/lib/diagnostics-log';

/**
 * 집 화면 "먹통 드래그" 진단 (2026-11-11 제보) — 집 탭에서 가끔 세로 스크롤과 좌우 탭 스와이프가
 * 함께 안 먹고, 하단 바로 다른 탭에 다녀와야 풀린다. 코드만으로는 어디서 멈추는지 특정하지 못해,
 * 다음에 재발했을 때 그 순간의 제스처 상태를 남긴다. 원인을 고치면 이 파일과 배선을 걷어낸다.
 *
 * 판정 근거: 정상일 때는 드래그가 24px(탭 페이저)·12px(당겨서 새로고침) 안에서 네이티브 제스처에
 * 잡히고, 그 순간 RN 터치가 **취소**된다. 그러니 손가락이 멀리 움직였는데도 RN `touchEnd`가
 * 정상 종료로 오고 페이저·스크롤이 제자리면, 아무 제스처도 그 드래그를 받지 않은 것이다.
 *
 * 남기는 것은 제스처 상태 요약뿐이다 — 좌표·식별자·사용자 입력은 싣지 않는다.
 */

/** 드래그로 볼 최소 이동(px) — 탭 페이저 판정 거리(24)의 두 배 이상. */
export const DEAD_DRAG_MIN_DISTANCE = 60;
/** 이보다 오래 누른 터치는 길게 누르기(자리 옮기기·집 순서 바꾸기)라 뺀다. */
export const DEAD_DRAG_MAX_DURATION_MS = 1500;
/** 한 축이 다른 축보다 이만큼 우세해야 그 축의 드래그로 본다. */
const AXIS_DOMINANCE = 1.5;
/** 앱 실행당 보고 상한 — 판정이 틀렸을 때 이벤트가 쏟아지지 않게. */
export const DEAD_DRAG_SESSION_CAP = 5;

export type GestureReading = {
  /** 요약 상태 — 짧은 문자열. 보고에 그대로 실린다. */
  state: string;
  /** 드래그를 받았으면 달라지는 값(페이저 위치·스크롤 위치). 시작과 끝을 비교한다. */
  motion?: string;
};
type Reader = () => GestureReading;

type ActiveTouch = {
  x: number;
  y: number;
  at: number;
  screen: string;
  motions: Record<string, string | undefined>;
};

const readers = new Map<string, Reader>();
let active: ActiveTouch | null = null;
let houseSawTouch = false;
let reported = 0;

function readAll(): Record<string, GestureReading> {
  const out: Record<string, GestureReading> = {};
  readers.forEach((read, name) => {
    try {
      out[name] = read();
    } catch {
      out[name] = { state: 'err' };
    }
  });
  return out;
}

/** 제스처 소유자(탭 페이저·집 화면·화면 층)가 자기 상태를 읽는 함수를 건다. 해제 함수를 돌려준다. */
export function registerGestureReader(name: string, read: Reader): () => void {
  readers.set(name, read);
  return () => {
    if (readers.get(name) === read) readers.delete(name);
  };
}

/** 집 화면 루트가 이번 터치를 받았다 — 셸은 받았는데 집이 못 받았으면 위에서 가로챈 것이다. */
export function noteHouseTouch() {
  houseSawTouch = true;
}

export function deadDragTouchStart(input: { x: number; y: number; screen: string; now?: number }) {
  try {
    houseSawTouch = false;
    if (input.screen !== 'house') {
      active = null;
      return;
    }
    const readings = readAll();
    const motions: Record<string, string | undefined> = {};
    Object.keys(readings).forEach((name) => {
      motions[name] = readings[name].motion;
    });
    active = {
      x: input.x,
      y: input.y,
      at: input.now ?? Date.now(),
      screen: input.screen,
      motions,
    };
  } catch {
    active = null;
  }
}

/** 네이티브 제스처가 터치를 가져갔다(정상) — 판정하지 않는다. */
export function deadDragTouchCancel() {
  active = null;
}

export type DeadDragAxis = 'x' | 'y';

/** 이동량으로 드래그 축을 가린다 — 드래그가 아니면 null. */
export function dragAxis(dx: number, dy: number): DeadDragAxis | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax >= DEAD_DRAG_MIN_DISTANCE && ax > ay * AXIS_DOMINANCE) return 'x';
  if (ay >= DEAD_DRAG_MIN_DISTANCE && ay > ax * AXIS_DOMINANCE) return 'y';
  return null;
}

/**
 * 터치가 정상 종료됐다. 먹통 드래그면 진단 기록과 분석 이벤트를 남기고 true를 돌려준다.
 */
export function deadDragTouchEnd(input: {
  x: number;
  y: number;
  screen: string;
  now?: number;
}): boolean {
  try {
    const start = active;
    active = null;
    if (!start || input.screen !== 'house') return false;
    const ms = (input.now ?? Date.now()) - start.at;
    if (ms > DEAD_DRAG_MAX_DURATION_MS) return false;
    const dx = Math.round(input.x - start.x);
    const dy = Math.round(input.y - start.y);
    const axis = dragAxis(dx, dy);
    if (!axis) return false;
    const readings = readAll();
    const moved = Object.keys(readings).some(
      (name) => readings[name].motion !== start.motions[name],
    );
    if (moved) return false;
    if (reported >= DEAD_DRAG_SESSION_CAP) return false;
    reported += 1;
    const state = (name: string) => readings[name]?.state ?? 'none';
    const props = {
      axis,
      dx,
      dy,
      ms,
      house_touch: houseSawTouch,
      pager: state('pager'),
      house: state('house'),
      layers: state('layers'),
    };
    recordGesture(
      `dead-drag ${axis} dx=${dx} dy=${dy} ${ms}ms houseTouch=${houseSawTouch ? 1 : 0}` +
        ` pager[${props.pager}] house[${props.house}] layers[${props.layers}]`,
    );
    track('house_dead_drag', props);
    return true;
  } catch {
    active = null;
    return false;
  }
}

/** 테스트 전용 — 모듈 상태 초기화. */
export function __resetDeadDragProbeForTests() {
  readers.clear();
  active = null;
  houseSawTouch = false;
  reported = 0;
}
