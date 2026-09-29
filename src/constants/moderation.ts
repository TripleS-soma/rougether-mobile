import { FEED_ENABLED } from '@/constants/feed';

/**
 * 신고·차단 (#1428) — 이용자 생성 콘텐츠(피드·AI 사진 가구)에 붙는 기능이라 피드와 같이
 * 켜진다. 꺼져 있으면 설정의 '차단한 사용자' 행도 숨는다(오늘 사용자에게 보이는 변화 없음).
 */
export const MODERATION_ENABLED = FEED_ENABLED;

/** 신고 설명 최대 길이 (서버 `ContentReportRequest.detail` `@Size(max = 500)`). */
export const REPORT_DETAIL_MAX = 500;

/** 차단 목록 한 페이지 (서버 기본 20, 1–50). */
export const BLOCKED_USERS_PAGE_SIZE = 20;
