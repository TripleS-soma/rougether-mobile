import { DEFAULT_LANGUAGE, i18n } from '@/i18n';

/**
 * 미니게임 WebView 문구 (#893). 게임 문서는 WebView 안에서 돌아 앱의 i18n에 닿지 못하므로,
 * HTML을 만드는 시점의 언어로 `minigame.<game>` 문구를 **보간 전 원문 그대로** 꺼내 설정 JSON에
 * 싣는다. 문서 안에서는 `fmt(copy.key, { score })`가 `{{score}}` 자리표시자를 채운다.
 * 언어를 바꾸면 다음에 만드는 문서(다음 게임)부터 반영된다.
 *
 * 문구만 다룬다: 규칙·점수·`rulesVersion` 같은 서버 검증 계약과 무관하다.
 */
export type MinigameName = 'merge' | 'runner' | 'stairs';
export type MinigameCopy = Record<string, string>;

type Bundle = { minigame?: Record<string, Record<string, string>> };

function bundleFor(language: string): Bundle | undefined {
  return i18n.getResourceBundle(language, 'translation') as Bundle | undefined;
}

/** 현재 언어(없으면 기본 언어)의 공통 + 게임별 문구. 키가 빠지면 기본 언어 값으로 메운다. */
export function getMinigameCopy(game: MinigameName): MinigameCopy {
  const fallback = bundleFor(DEFAULT_LANGUAGE)?.minigame ?? {};
  const current = bundleFor(i18n.resolvedLanguage ?? i18n.language)?.minigame ?? fallback;
  return {
    ...fallback.common,
    ...fallback[game],
    ...current.common,
    ...current[game],
  };
}

/** HTML 본문·속성에 넣는 문구 이스케이프: 번역 값에 `<`·`"`가 들어와도 마크업이 깨지지 않게. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 문서의 lang 속성. 스크린리더 발음 선택용. */
export function minigameDocumentLanguage(): string {
  return escapeHtml(i18n.resolvedLanguage ?? i18n.language ?? DEFAULT_LANGUAGE);
}

/**
 * 문서 안에서 쓰는 보간 함수의 소스. 각 게임 스크립트 앞에 붙인다.
 * i18next와 같은 `{{name}}` 문법만 지원한다(형식 지정자 없음).
 */
export const MINIGAME_FMT_SOURCE = String.raw`function fmt(template, values) {
  return String(template).replace(/\{\{\s*(\w+)\s*\}\}/g, function (_, key) {
    return values && values[key] !== undefined ? String(values[key]) : '';
  });
}`;
