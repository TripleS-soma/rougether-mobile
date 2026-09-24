/**
 * 공개 SNS 피드 (#1409) — 서버 계약 `rougether-spec/domains/feed`.
 *
 * **FEED_ENABLED = false인 동안 피드는 사용자에게 전혀 보이지 않는다** — 하단 탭·시작 화면
 * 선택지·알림 설정 행 모두 이 플래그로 숨는다. 이용자 생성 콘텐츠(UGC)를 공개하려면
 * 신고·차단 수단이 앱 안에 있어야 한다(App Store 심사 가이드 1.2). 서버의 신고·차단 API
 * (TripleS-soma/rougether-server#399)가 생기고 앱에 연결한 뒤에 켠다. 켤 때는 개인정보
 * 처리방침·스토어 문구도 같이 고친다(AGENTS.md "새 데이터·새 권한").
 */
export const FEED_ENABLED = false;

/** 게시물당 사진 1–10장 (POST /feed/posts `imageIds`). */
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
