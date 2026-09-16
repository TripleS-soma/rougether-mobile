/**
 * 위젯 문구 (#893) — 위젯은 앱 화면이 아니라 헤드리스 태스크(안드로이드)·Swift(iOS)가
 * 그리므로 `useT()`를 쓸 수 없고, 앱의 "현재 언어"도 모른다. 앱이 요약을 저장할 때
 * 언어를 함께 남기고(`WidgetSummary.lang`), 위젯은 그 언어로 **고정 조회**한다.
 *
 * `@/i18n`은 인라인 리소스로 초기화되므로 헤드리스 태스크에서도 import만으로 조회된다.
 * 인스턴스의 현재 언어(`i18n.language`)는 바꾸지 않는다 — 앱이 떠 있을 때 위젯 갱신이
 * 앱 언어를 흔들면 안 된다.
 */
import { type AppLanguage, DEFAULT_LANGUAGE, i18n, isAppLanguage } from '@/i18n';

/** 요약에 남은 언어 — 없거나(구버전 저장값) 모르는 값이면 기본 언어(한국어). */
export function widgetLanguage(lang: unknown): AppLanguage {
  return isAppLanguage(lang) ? lang : DEFAULT_LANGUAGE;
}

/** 저장 시점의 앱 언어 — `i18n.language`가 'en-US'처럼 올 수도 있어 앞 두 글자로 좁힌다. */
export function currentWidgetLanguage(): AppLanguage {
  return widgetLanguage((i18n.language ?? '').slice(0, 2));
}

export type WidgetCopyKey =
  | 'moodCrying'
  | 'moodSad'
  | 'moodCrown'
  | 'moodHappy'
  | 'moodWorried'
  | 'emptyToday'
  | 'allDone'
  | 'more'
  | 'roomEmpty'
  | 'streakDays';

export function widgetCopy(
  lang: unknown,
  key: WidgetCopyKey,
  options?: Record<string, string | number>,
): string {
  return i18n.t(`notification.widget.${key}`, { ...options, lng: widgetLanguage(lang) });
}
