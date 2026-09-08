/**
 * 소셜 로그인 클라이언트 식별자 (#489 B안) — 네이티브(`google-auth.ts`)와
 * 웹(`google-auth.web.ts`)이 같은 값을 써야 서버 `/auth/google`의 aud 허용목록과
 * 맞는다. 비밀이 아니다(aud 대조용 공개 식별자). 백엔드 GCP 프로젝트
 * rougether(499923665503)의 OAuth 클라이언트.
 */

/** 웹 클라이언트 ID — idToken의 aud로 찍히는 값. 서버 allowlist에 등록된 것과 동일. */
export const GOOGLE_WEB_CLIENT_ID =
  '499923665503-f2l1b05h9q48f4lda8reh65d9hdh1jfo.apps.googleusercontent.com';
/** iOS 클라이언트 ID — Firebase plist(다른 프로젝트)의 CLIENT_ID를 iOS 레이어가 주워가지 않게 명시. */
export const GOOGLE_IOS_CLIENT_ID =
  '499923665503-b1brsuooa940tjrs8vapo4dl2m8mri19.apps.googleusercontent.com';
