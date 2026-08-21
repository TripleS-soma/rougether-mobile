/**
 * 소셜 로그인 실패를 **읽을 수 있는 형태로** 만든다 (#959).
 *
 * 종전엔 세 provider가 전부 `catch {}` 로 에러를 통째로 버렸다. 배포본에서만
 * 나는 장애(서명 키가 달라 개발 빌드에서는 재현되지 않는다)에서 원격 신호가
 * 유일한 단서인데, 그 신호를 우리가 지우고 있었다.
 */

/**
 * 구글 로그인 상태 코드 중 **원인이 확정되는 것**만 사람 말로 옮긴다.
 * 라이브러리의 `statusCodes`를 import하지 않는 이유: 값이 문자열/숫자로
 * 플랫폼마다 갈리고, 네이티브 모듈이 없는 환경(웹·테스트)에서 import 자체가
 * 던진다. 우리는 받은 값을 문자열로 비교하기만 하면 된다.
 */
const GOOGLE_CODE_HINT: Record<string, string> = {
  // Android에서 SHA-1/패키지명이 OAuth 클라이언트와 안 맞을 때. 배포본에서만
  // 나는 대표적 증상 — Play 앱 서명은 업로드 키와 지문이 다르기 때문이다.
  '10': '이 빌드의 서명이 콘솔에 등록되지 않았습니다 (SHA-1/패키지명 불일치)',
  DEVELOPER_ERROR: '이 빌드의 서명이 콘솔에 등록되지 않았습니다 (SHA-1/패키지명 불일치)',
  '7': '네트워크 오류',
  NETWORK_ERROR: '네트워크 오류',
  '12500': '로그인 설정 오류 (SIGN_IN_REQUIRED / 구성 확인 필요)',
};

export type LoginFailure = {
  /** 제공자가 준 코드 — 있으면 이게 원인 판정의 핵심이다. */
  code?: string;
  /** 한 줄 메시지 (길면 잘린다 — 분석 파라미터 상한). */
  message?: string;
  /** 아는 코드면 사람 말 설명. 모르면 undefined. */
  hint?: string;
};

/** 로그인 실패 원인 추출 — 어떤 모양의 에러가 와도 던지지 않는다. */
export function describeLoginError(err: unknown): LoginFailure {
  const e = (err ?? {}) as { code?: unknown; message?: unknown };
  const code = e.code == null ? undefined : String(e.code).slice(0, 40);
  const message = typeof e.message === 'string' && e.message ? e.message.slice(0, 120) : undefined;
  return { code, message, hint: code ? GOOGLE_CODE_HINT[code] : undefined };
}

/**
 * 사용자에게 보일 실패 문구. 코드가 있으면 **괄호로 짧게 붙인다** — 사용자에겐
 * 무의미하지만 테스터가 스크린샷 한 장만 보내면 원인이 갈린다.
 */
export function loginErrorMessage(base: string, failure: LoginFailure): string {
  return failure.code ? `${base} (${failure.code})` : base;
}

/**
 * 마지막 로그인 실패 (#959) — 화면이 코드를 덧붙여 보여주려고 읽는다.
 * `getPushDiagnostic`(#903)과 같은 결: 조용히 사라지던 값을 한 곳에 남긴다.
 */
let lastFailure: LoginFailure | null = null;

export function rememberLoginFailure(f: LoginFailure) {
  lastFailure = f;
}

export function getLastLoginFailure(): LoginFailure | null {
  return lastFailure;
}

/** 성공하면 지운다 — 다음 실패 때 옛 코드가 붙으면 안 된다. */
export function clearLoginFailure() {
  lastFailure = null;
}
