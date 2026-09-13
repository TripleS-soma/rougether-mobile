import type { Screen } from '@/components/app/navigation';

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

export const ANNOUNCEMENTS: readonly Announcement[] = [
  {
    id: '2026-09-13-minigames',
    date: '2026-09-13',
    title: '방에서 즐기는 미니게임 3종',
    body: '루틴 러너·고양이 계단·고양이 합치기. 방 오른쪽 게임 아이콘에서 골라 전체 랭킹에 도전해요.',
    action: { kind: 'screen', screen: 'minigames', label: '게임 하러 가기' },
  },
  {
    id: '2026-09-13-auto-attendance',
    date: '2026-09-13',
    title: '출석은 자동으로, 달력엔 공휴일',
    body: '그날 첫 루틴을 완료하면 출석 체크가 저절로 돼요. 달력의 공휴일은 빨간색으로 표시돼요.',
  },
  {
    id: '2026-09-11-web-app',
    date: '2026-09-11',
    title: '데스크톱·브라우저에서도 루게더',
    body: '같은 계정으로 로그인하면 방과 루틴이 그대로예요. 컴퓨터로 할 일을 정리할 때 편해요.',
    action: { kind: 'url', url: 'https://app.rougether.com', label: '웹에서 열기' },
  },
];

/** 접힌 상태에서 보여주는 최근 소식 수. */
export const RECENT_ANNOUNCEMENT_COUNT = 3;

/** `2026-09-13` → `9월 13일` — 알림 행의 날짜 표기와 같은 꼴. */
export function announcementDateLabel(date: string): string {
  const [, month, day] = date.split('-').map(Number);
  return `${month}월 ${day}일`;
}
