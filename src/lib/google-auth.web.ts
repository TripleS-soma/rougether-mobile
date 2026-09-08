/**
 * 구글 **웹** 로그인 — `google-auth.ts`의 웹 변형. Metro가 웹 번들에서만 이
 * 파일을 고르므로 네이티브 SDK(@react-native-google-signin)는 웹에 들어가지
 * 않는다. Google Identity Services(GIS)로 id token을 받아 네이티브와 같은
 * 계약(`getGoogleIdToken` → 서버 `/auth/google`)을 지킨다 — aud는 같은 웹
 * 클라이언트 ID라 서버 allowlist를 그대로 통과한다.
 *
 * 왜 숨은 공식 버튼인가: GIS가 id token(credential)을 주는 경로는 One Tap
 * `prompt()`와 공식 버튼뿐이고, One Tap은 쿨다운·FedCM 사정으로 안 뜨는 경우가
 * 많다. 화면의 버튼은 우리 디자인이므로, 보이지 않는 곳에 공식 버튼을 그려
 * 두고 사용자의 탭 안에서 그 버튼을 눌러 팝업을 연다(사용자 제스처 안이어야
 * 팝업 차단을 피한다 — 첫 await 전에 클릭해야 하므로 스크립트는 모듈 로드 시
 * 미리 받아 둔다).
 */
import { GOOGLE_WEB_CLIENT_ID } from './oauth-client-ids';

type CredentialResponse = { credential?: string };
type GoogleId = {
  initialize(config: Record<string, unknown>): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
  disableAutoSelect(): void;
};
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

const GSI_SRC = 'https://accounts.google.com/gsi/client';
/** 팝업이 닫힌 뒤(창에 포커스 복귀) 이만큼 기다려도 credential이 없으면 취소로 본다. */
const CANCEL_GRACE_MS = 1500;

let host: HTMLDivElement | null = null;
let ready: Promise<GoogleId> | null = null;
let pending: ((token: string | null) => void) | null = null;

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

function ensureReady(): Promise<GoogleId> {
  ready ??= loadScript().then((id) => {
    id.initialize({
      client_id: GOOGLE_WEB_CLIENT_ID,
      ux_mode: 'popup',
      // 자동 선택 없이 매번 계정 선택 — 최근 로그인 배지가 "누구로" 안내한다.
      auto_select: false,
      itp_support: true,
      callback: (res: CredentialResponse) => {
        const resolve = pending;
        pending = null;
        resolve?.(res.credential ?? null);
      },
    });
    host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText =
      'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
    document.body.appendChild(host);
    id.renderButton(host, { type: 'standard', size: 'large', theme: 'outline' });
    return id;
  });
  return ready;
}

// 첫 탭에서 스크립트를 기다리지 않도록 로그인 화면이 뜨기 전에 미리 받아 둔다.
if (typeof document !== 'undefined') {
  void ensureReady().catch(() => {
    // 실패는 실제 로그인 시도에서 다시 드러난다(그때 throw → 'failed').
    ready = null;
  });
}

function hiddenButton(): HTMLElement | null {
  return host?.querySelector<HTMLElement>('div[role="button"]') ?? null;
}

/**
 * 구글 계정 선택 팝업을 띄우고 id token을 반환한다.
 * - 사용자가 팝업을 닫으면 null (에러 아님 — 조용히 로그인 화면 유지).
 * - 스크립트 로드 실패 등은 throw — 호출부가 실패 메시지를 띄운다.
 */
export async function getGoogleIdToken(): Promise<string | null> {
  await ensureReady();
  const button = hiddenButton();
  if (!button) throw new Error('google sign-in button not rendered');
  return new Promise<string | null>((resolve) => {
    let settled = false;
    const finish = (token: string | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onFocus);
      resolve(token);
    };
    // 팝업이 닫히면 본 창이 포커스를 되찾는다 — credential 콜백이 곧 따라오지
    // 않으면 사용자가 창을 닫은 것(취소). 성공 시엔 콜백이 먼저 finish한다.
    const onFocus = () => {
      window.setTimeout(() => finish(null), CANCEL_GRACE_MS);
    };
    pending = finish;
    window.addEventListener('focus', onFocus);
    button.click();
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
