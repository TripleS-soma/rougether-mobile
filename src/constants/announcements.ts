import type { Screen } from '@/components/app/navigation';
import { i18n } from '@/i18n';

/**
 * 앱 번들 공지 (#1320) — 알림 탭 상단 "새 소식" 섹션의 단일 출처.
 *
 * 서버 알림과 달리 **전원에게 같은 내용**이라 앱에 싣고 OTA로 갱신한다.
 * 문구는 스토어 릴리스 노트(`store/ko-KR`)와 별도 — 여기는 "바로 해보기"를
 * 유도하는 인앱 문체다. 읽음 상태만 계정별로 기기에 남긴다
 * (`src/lib/announcements-store.ts`).
 *
 * 규칙: 최신이 위. `id`는 한 번 게시하면 바꾸지 않는다(읽음 키). 지난 소식은
 * 지우지 말고 아래로 — 읽음 집합이 가리키는 id가 사라지면 그만이다.
 *
 * 제목·본문·행동 라벨은 i18n 리소스 `notification.announcements.<id>.{title,body,action}`
 * (#893) — 여기는 id·게시일·행동 대상만 두고, `getAnnouncements()`가 호출 시점 언어로
 * 풀어 준다(모듈 로드 시 번역하지 않는다).
 */
export type AnnouncementAction =
  /** 앱 안 화면으로 (셸 `setScreen`). */
  | { kind: 'screen'; screen: Screen; label: string }
  /** 외부 링크 (`Linking.openURL`). */
  | { kind: 'url'; url: string; label: string };

export type Announcement = {
  id: string;
  /** 게시일 ISO `YYYY-MM-DD` — 표시는 `announcementDateLabel`. */
  date: string;
  title: string;
  body: string;
  action?: AnnouncementAction;
};

type AnnouncementActionSource = { kind: 'screen'; screen: Screen } | { kind: 'url'; url: string };

type AnnouncementSource = {
  id: string;
  date: string;
  action?: AnnouncementActionSource;
};

const ANNOUNCEMENT_SOURCES: readonly AnnouncementSource[] = [
  {
    id: '2026-09-13-minigames',
    date: '2026-09-13',
    action: { kind: 'screen', screen: 'minigames' },
  },
  {
    id: '2026-09-13-auto-attendance',
    date: '2026-09-13',
  },
  {
    id: '2026-09-11-web-app',
    date: '2026-09-11',
    action: { kind: 'url', url: 'https://app.rougether.com' },
  },
];

/** 번역 함수 모양 — `useT()`의 `tr`이나 `i18n.t`를 그대로 넘긴다. */
export type AnnouncementTranslate = (key: string, options?: Record<string, unknown>) => string;

const defaultTranslate: AnnouncementTranslate = (key, options) => i18n.t(key, options);

/**
 * 공지 목록을 현재 언어로 — 화면·훅은 `useT()`의 `tr`을 넘겨 언어가 바뀔 때 다시 계산한다.
 * 최신이 위(`ANNOUNCEMENT_SOURCES` 순서).
 */
export function getAnnouncements(t: AnnouncementTranslate = defaultTranslate): Announcement[] {
  return ANNOUNCEMENT_SOURCES.map((a) => {
    const base = `notification.announcements.${a.id}`;
    return {
      id: a.id,
      date: a.date,
      title: t(`${base}.title`),
      body: t(`${base}.body`),
      action: a.action ? { ...a.action, label: t(`${base}.action`) } : undefined,
    };
  });
}

/** 접힌 상태에서 보여주는 최근 소식 수. */
export const RECENT_ANNOUNCEMENT_COUNT = 3;

/** `2026-09-13` → `9월 13일` — 알림 행의 날짜 표기와 같은 꼴. */
export function announcementDateLabel(
  date: string,
  t: AnnouncementTranslate = defaultTranslate,
): string {
  const [, month, day] = date.split('-').map(Number);
  return t('notification.news.dateLabel', { month, day });
}
