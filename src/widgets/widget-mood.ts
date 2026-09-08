/**
 * 홈 위젯 캐릭터 표정·문구 (#1122, 안드로이드 먼저) — 위젯은 앱 프로세스를
 * 못 띄우므로 앱이 남긴 오늘 요약 + 마지막 접속 시각과 **지금 시각**만으로
 * 상태를 정한다. 태스크 핸들러가 30분마다 다시 그리니 앱을 안 켜도 저녁·
 * 미접속 일수에 따라 바뀐다.
 *
 * 우선순위: 오래 안 옴(울음 5일+ > 슬픔 2일+) > 오늘 다 함(왕관 7일 스트릭 >
 * 기쁨) > 저녁인데 남음(걱정) > 평소. 앱 아이콘 자동 변경(#1147)과 같은
 * 임계값(48h·96h는 아이콘, 여기선 위젯 스펙의 2일·5일)이라 결이 맞는다.
 */
import type { WidgetSummary } from '@/widgets/widget-data';

export type WidgetFace = 'neutral' | 'happy' | 'crown' | 'worried' | 'sad' | 'crying';

export type WidgetMood = {
  face: WidgetFace;
  /** 캐릭터 옆에 붙는 한 줄 — 평소(neutral)에는 없다(남은 루틴 목록이 그 자리). */
  message?: string;
};

/** 걱정 표정으로 바뀌는 시각(기기 로컬) — 퇴근·저녁 시간대 "아직 남았어요". */
export const WIDGET_EVENING_HOUR = 18;
/** 미접속 임계 — 위젯 스펙(#1122): 2일+ 슬픔·거미줄, 5일+ 우는 얼굴. */
export const WIDGET_SAD_DAYS = 2;
export const WIDGET_CRYING_DAYS = 5;
/** 왕관 — 앱 아이콘(#1147)과 같은 7일 유효 스트릭. */
export const WIDGET_CROWN_STREAK = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** 표정별 이미지 — 앱 아이콘 아트(#1147)를 192px로 줄인 사본. OTA 번들에 실린다. */
export const WIDGET_FACE_IMAGES: Record<WidgetFace, number> = {
  neutral: require('@/assets/images/widget-faces/neutral.png'),
  happy: require('@/assets/images/widget-faces/happy.png'),
  crown: require('@/assets/images/widget-faces/crown.png'),
  worried: require('@/assets/images/widget-faces/worried.png'),
  sad: require('@/assets/images/widget-faces/sad.png'),
  crying: require('@/assets/images/widget-faces/crying.png'),
};

export function daysSince(lastActiveAt: string | null | undefined, now: Date): number {
  if (!lastActiveAt) return 0;
  const at = Date.parse(lastActiveAt);
  if (!Number.isFinite(at)) return 0;
  return Math.max(0, Math.floor((now.getTime() - at) / DAY_MS));
}

export function resolveWidgetMood({
  summary,
  todayIso,
  now,
  lastActiveAt,
}: {
  summary: WidgetSummary;
  /** 기기 로컬 오늘 — 요약의 `date`와 비교해 어제 요약으로 "다 했다"고 우기지 않게. */
  todayIso: string;
  now: Date;
  lastActiveAt: string | null | undefined;
}): WidgetMood {
  const inactiveDays = daysSince(lastActiveAt, now);
  if (inactiveDays >= WIDGET_CRYING_DAYS) {
    return { face: 'crying', message: `${inactiveDays}일이나 못 봤어요… 흑흑` };
  }
  if (inactiveDays >= WIDGET_SAD_DAYS) {
    return { face: 'sad', message: `${inactiveDays}일째 못 봤어요, 보고 싶어요` };
  }
  // `date`가 없는 요약은 구버전 앱이 남긴 것 — 오늘 것으로 간주한다(호환).
  const isToday = summary.date == null || summary.date === todayIso;
  const remaining = summary.total - summary.done;
  if (isToday && summary.total > 0 && remaining <= 0) {
    return summary.streak >= WIDGET_CROWN_STREAK
      ? { face: 'crown', message: `${summary.streak}일 연속! 최고예요` }
      : { face: 'happy', message: '오늘도 다 해냈어요!' };
  }
  if (isToday && remaining > 0 && now.getHours() >= WIDGET_EVENING_HOUR) {
    return { face: 'worried', message: `아직 ${remaining}개 남았어요` };
  }
  return { face: 'neutral' };
}
