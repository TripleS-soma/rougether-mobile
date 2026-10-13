/**
 * 구글 **웹** 로그인 — `google-auth.ts`의 웹 변형. Metro가 웹 번들에서만 이
 * 파일을 고르므로 네이티브 SDK(@react-native-google-signin)는 웹에 들어가지
 * 않는다. Google Identity Services(GIS)로 id token을 받아 네이티브와 같은
 * 계약(`getGoogleIdToken` → 서버 `/auth/google`)을 지킨다 — aud는 같은 웹
 * 클라이언트 ID라 서버 allowlist를 그대로 통과한다.
 *
 * 공식 버튼을 화면에 그대로 둔다(#1532). 예전엔 공식 버튼을 화면 밖에 숨겨 두고
 * 우리 디자인 버튼을 누르면 JS로 그 버튼을 클릭했는데, GIS가 버튼을 **구글 도메인
 * iframe** 안에 그리도록 바뀌면서(2026-10 확인) 우리 페이지가 버튼을 찾지도
 * 누르지도 못해 웹 구글 로그인이 통째로 막혔다. 사용자가 공식 버튼을 직접 누르면
 * GIS가 `callback`으로 credential을 주고, 그 순간 화면이 평소 로그인 흐름
 * (`getGoogleIdToken` → 서버)을 시작한다 — 받아 둔 credential을 돌려주는 식.
 */
import { GOOGLE_WEB_CLIENT_ID } from './oauth-client-ids';

type CredentialResponse = { credential?: string };
type PromptMoment = {
  isSkippedMoment?: () => boolean;
  isDismissedMoment?: () => boolean;
  getDismissedReason?: () => string;
};
type GoogleId = {
  initialize(config: Record<string, unknown>): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
  prompt(listener?: (moment: PromptMoment) => void): void;
  disableAutoSelect(): void;
};
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

const GSI_SRC = 'https://accounts.google.com/gsi/client';
/** One Tap 대체 경로가 아무 응답 없이 머무를 수 있는 최대 시간 — 로그인 버튼이 잠기지 않게. */
export const PROMPT_TIMEOUT_MS = 60_000;

export type GoogleButtonOptions = {
  /** px, GIS 허용 범위 200~400. */
  width: number;
  theme: 'outline' | 'filled_black';
  /** BCP 47 — 버튼 문구 언어("Google로 계속하기"/"Continue with Google"). */
  locale: string;
};

let ready: Promise<GoogleId> | null = null;
/** 공식 버튼으로 받아 두고 아직 로그인 흐름이 가져가지 않은 credential. */
let held: string | null = null;
let promptResolve: ((token: string | null) => void) | null = null;
const listeners = new Set<() => void>();

function loadScript(): Promise<GoogleId> {
  return new Promise((resolve, reject) => {
    const existing = window.google?.accounts?.id;
    if (existing) return resolve(existing);
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const id = window.google?.accounts?.id;
      if (id) resolve(id);
      else reject(new Error('google identity services unavailable after load'));
    };
    script.onerror = () => reject(new Error('google identity services script failed to load'));
    document.head.appendChild(script);
  });
}

function onCredential(res: CredentialResponse) {
  const token = res.credential ?? null;
  // One Tap 대체 경로가 기다리는 중이면 그쪽이 가져간다.
  // (정리는 finish가 한다 — 여기서 먼저 비우면 finish가 자기 차례가 아니라고 보고 버린다.)
  if (promptResolve) {
    promptResolve(token);
    return;
  }
  if (!token) return;
  held = token;
  listeners.forEach((listener) => listener());
}

function ensureReady(): Promise<GoogleId> {
  ready ??= loadScript().then((id) => {
    id.initialize({
      client_id: GOOGLE_WEB_CLIENT_ID,
      ux_mode: 'popup',
      // 자동 선택 없이 매번 계정 선택 — 최근 로그인 배지가 "누구로" 안내한다.
      auto_select: false,
      itp_support: true,
      callback: onCredential,
    });
    return id;
  });
  return ready;
}

// 로그인 화면이 버튼을 그리기 전에 스크립트를 미리 받아 둔다.
if (typeof document !== 'undefined') {
  void ensureReady().catch(() => {
    // 실패는 버튼을 그릴 때·로그인 시도에서 다시 드러난다.
    ready = null;
  });
}

/** 공식 구글 버튼을 `parent` 안에 그린다. 스크립트 로드 실패는 throw. */
export async function mountGoogleButton(
  parent: HTMLElement,
  { width, theme, locale }: GoogleButtonOptions,
): Promise<void> {
  const id = await ensureReady();
  parent.replaceChildren();
  id.renderButton(parent, {
    type: 'standard',
    size: 'large',
    theme,
    shape: 'rectangular',
    text: 'continue_with',
    logo_alignment: 'left',
    width: Math.round(Math.max(200, Math.min(400, width))),
    locale,
  });
}

/** 공식 버튼으로 credential을 받았을 때 — 화면이 로그인 흐름을 시작한다. 구독 해제 함수를 돌려준다. */
export function onGoogleCredential(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * id token을 반환한다. 공식 버튼으로 받아 둔 credential이 있으면 그것(1회용)을,
 * 없으면(예: 계정 충돌 안내의 [Google로 로그인]) One Tap을 띄워 기다린다.
 * - 받은 것이 없거나 사용자가 닫으면 null (에러 아님 — 조용히 로그인 화면 유지).
 * - 스크립트 로드 실패는 throw — 호출부가 실패 메시지를 띄운다.
 */
export async function getGoogleIdToken(): Promise<string | null> {
  if (held) {
    const token = held;
    held = null;
    return token;
  }
  const id = await ensureReady();
  return new Promise<string | null>((resolve) => {
    const finish = (token: string | null) => {
      if (promptResolve !== finish) return;
      promptResolve = null;
      window.clearTimeout(timer);
      resolve(token);
    };
    const timer = window.setTimeout(() => finish(null), PROMPT_TIMEOUT_MS);
    promptResolve = finish;
    id.prompt((moment) => {
      // 'credential_returned'로 닫히는 건 성공 — callback이 토큰을 넘긴다.
      const dismissed =
        moment.isDismissedMoment?.() && moment.getDismissedReason?.() !== 'credential_returned';
      if (moment.isSkippedMoment?.() || dismissed) finish(null);
    });
  });
}

/** 로그아웃 시 구글 자동 선택만 끈다(웹은 세션이 브라우저 것) — 실패해도 앱 로그아웃은 막지 않는다. */
export async function signOutGoogle(): Promise<void> {
  try {
    const id = await ensureReady();
    id.disableAutoSelect();
  } catch {
    // best-effort
  }
}
