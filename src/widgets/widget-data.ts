/**
 * 안드로이드 홈 위젯 데이터 계층 (#604) — 앱이 오늘 요약·방 캡처를 기기에
 * 기록하면 위젯 태스크(widget-task-handler)가 읽어 렌더한다. 위젯은 앱
 * 프로세스를 못 띄우므로 "앱이 쓰고 위젯이 읽는" 단방향이 전부다.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Routine } from '@/constants/routines';

const SUMMARY_KEY = 'rougether.widget.summary.v1';
const ROOM_IMAGE_KEY = 'rougether.widget.room-image.v1';

export type WidgetSummary = {
  done: number;
  total: number;
  streak: number;
  /** 미완료 루틴 제목 앞 3개 — 오늘 리스트 위젯의 행. */
  remaining: string[];
};

/**
 * 오늘 요약 계산 — 나의 방 방탭과 같은 집계(그날 예정 항목 기준). 예정
 * 판정(isScheduledOn)은 호출측에서 걸러 넘긴다(스케줄 규칙의 단일 출처는
 * my-room-screen).
 */
export function buildWidgetSummary(
  scheduled: Routine[],
  completions: Record<string, string[]>,
  streak: number,
  todayIso: string,
): WidgetSummary {
  const isDone = (r: Routine) => (completions[r.id] ?? []).includes(todayIso);
  return {
    done: scheduled.filter(isDone).length,
    total: scheduled.length,
    streak,
    remaining: scheduled
      .filter((r) => !isDone(r))
      .slice(0, 3)
      .map((r) => r.title),
  };
}

export async function saveWidgetSummary(summary: WidgetSummary): Promise<void> {
  try {
    await AsyncStorage.setItem(SUMMARY_KEY, JSON.stringify(summary));
  } catch {
    // 위젯은 부가 표면 — 저장 실패는 다음 갱신으로 수렴한다.
  }
}

export async function loadWidgetSummary(): Promise<WidgetSummary | null> {
  try {
    const raw = await AsyncStorage.getItem(SUMMARY_KEY);
    return raw ? (JSON.parse(raw) as WidgetSummary) : null;
  } catch {
    return null;
  }
}

/** 방 캡처(data URI PNG) — 내 방 위젯의 배경. 방이 바뀔 때만 갱신된다. */
export async function saveWidgetRoomImage(dataUri: string): Promise<void> {
  try {
    await AsyncStorage.setItem(ROOM_IMAGE_KEY, dataUri);
  } catch {
    // ignore — 위젯은 캡처 전 폴백(빈 방 문구)을 그린다.
  }
}

export async function loadWidgetRoomImage(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ROOM_IMAGE_KEY);
  } catch {
    return null;
  }
}
