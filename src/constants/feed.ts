import { UGC_AVAILABLE } from '@/constants/release-channel';

/**
 * 공개 SNS 피드 (#1409) — 서버 계약 `rougether-spec/domains/feed`.
 *
 * **FEED_ENABLED = false인 동안 피드는 사용자에게 전혀 보이지 않는다** — 하단 탭·시작 화면
 * 선택지·알림 설정 행 모두 이 플래그로 숨는다. 이용자 생성 콘텐츠(UGC)를 공개하려면
 * 신고·차단 수단이 앱 안에 있어야 한다(App Store 심사 가이드 1.2). 서버의 신고·차단 API
 * (TripleS-soma/rougether-server#399)가 생기고 앱에 연결한 뒤에 켠다. 켤 때는 개인정보
 * 처리방침·스토어 문구도 같이 고친다(AGENTS.md "새 데이터·새 권한").
 *
 * 2026-09-29부터 내부 테스트 채널에서만 켰다. **2026-10-05 결정: 웹은 지금 열고, 스토어 앱은
 * 다음 네이티브 버전(1.5.4) 심사 때 켠 채로 제출** — 심사 때 꺼져 있던 1.5.3 바이너리에는 OTA로
 * 켜지 않는다(App Store 2.5.2·연령 등급). 판정은 `UGC_AVAILABLE`(런타임 지문)이 한다.
 */
export const FEED_ENABLED = UGC_AVAILABLE;

/**
 * 작성 화면의 기본 게시판 (서버 #428). 서버는 boardType을 생략하면 `VERIFICATION`으로 받지만
 * 앱은 항상 명시해서 보낸다. 기본을 `FREE`로 두는 건 사진 없이도 바로 쓸 수 있는 가벼운 쪽이라서
 * — 사진을 고른 사람은 한 번 눌러 인증게시판으로 옮긴다.
 */
export const FEED_DEFAULT_BOARD = 'FREE' as const;

/** 게시물당 사진 최대 10장 — 자유게시판 0–10장, 인증게시판 1–10장 (POST /feed/posts `imageIds`). */
export const FEED_MAX_IMAGES = 10;
/** 본문 최대 2,000자(UTF-16) — TextInput maxLength도 UTF-16 단위라 그대로 맞는다. */
export const FEED_MAX_CONTENT = 2000;
/** 댓글 최대 500자. */
export const FEED_MAX_COMMENT = 500;
/** 사진 원본당 10MiB (POST /feed/images). */
export const FEED_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/** 서버가 받는 원본 형식 — 그 밖의 형식은 올리기 전에 거른다. */
export const FEED_IMAGE_TYPES: readonly string[] = ['image/jpeg', 'image/png'];
/** 목록 한 페이지 (서버 기본 20, 최대 50). */
export const FEED_PAGE_SIZE = 20;
/**
 * 인증글에 연결할 수 있는 루틴 완료의 기간 (서버 #430) — KST 오늘과 그 이전 6일, 총 7일.
 * 루틴 고르기가 이 날짜들의 GET /calendar를 받는다.
 */
export const FEED_ROUTINE_WINDOW_DAYS = 7;
