/**
 * @jest-environment jsdom
 *
 * 구글 웹 로그인 배선 (#1225 리뷰) — 팝업 취소·차단 판정은 순수 함수가 아니라
 * window 이벤트 위에 있어 여기서 jsdom으로 검증한다. GIS 스크립트는 로드하지
 * 않고 `window.google.accounts.id` 스텁을 모듈 로드 전에 심는다(모듈이 로드
 * 시점에 `ensureReady()`를 미리 부른다).
 */
import { URL as NodeURL, URLSearchParams as NodeURLSearchParams } from 'node:url';

// jest-expo 프리셋이 RN의 URL·URLSearchParams 스텁을 전역에 심는다(객체 인자를
// 받으면 throw). 브라우저 배선 테스트는 실제 구현이 필요해 Node 것으로 되돌린다.
beforeAll(() => {
  Object.assign(globalThis, { URL: NodeURL, URLSearchParams: NodeURLSearchParams });
});

type GoogleAuthWeb = typeof import('@/lib/google-auth.web');

let credentialCallback: (res: { credential?: string }) => void = () => {};

function installGoogleStub() {
  (window as Window & { google?: unknown }).google = {
    accounts: {
      id: {
        initialize: (cfg: { callback: typeof credentialCallback }) => {
          credentialCallback = cfg.callback;
        },
        renderButton: (parent: HTMLElement) => {
          const button = document.createElement('div');
          button.setAttribute('role', 'button');
          parent.appendChild(button);
        },
        disableAutoSelect: jest.fn(),
      },
    },
  };
}

async function loadModule(): Promise<GoogleAuthWeb> {
  installGoogleStub();
  let mod!: GoogleAuthWeb;
  // 동적 import는 jest(CommonJS)에서 --experimental-vm-modules가 필요해 require로.
  jest.isolateModules(() => {
    mod = jest.requireActual('@/lib/google-auth.web') as GoogleAuthWeb;
  });
  // 모듈 로드 시 시작한 ensureReady()가 버튼을 그릴 때까지.
  await Promise.resolve();
  await Promise.resolve();
  return mod;
}

function expectPending(p: Promise<unknown>) {
  const marker = Symbol('pending');
  return expect(Promise.race([p, Promise.resolve(marker)])).resolves.toBe(marker);
}

describe('getGoogleIdToken (web)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('팝업이 뜨고 credential이 오면 id token을 돌려준다', async () => {
    const { getGoogleIdToken } = await loadModule();
    const p = getGoogleIdToken();
    await Promise.resolve();
    window.dispatchEvent(new Event('blur'));
    credentialCallback({ credential: 'id-token' });
    await expect(p).resolves.toBe('id-token');
  });

  it('팝업을 닫고 돌아왔는데 credential이 없으면 유예 뒤 null (취소)', async () => {
    const { getGoogleIdToken, CANCEL_GRACE_MS } = await loadModule();
    const p = getGoogleIdToken();
    await Promise.resolve();
    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(new Event('focus'));
    jest.advanceTimersByTime(CANCEL_GRACE_MS);
    await expect(p).resolves.toBeNull();
  });

  it('제한 시간 안에 창이 포커스를 잃지 않으면(팝업 차단) 영원히 기다리지 않고 throw', async () => {
    const { getGoogleIdToken, POPUP_OPEN_TIMEOUT_MS } = await loadModule();
    const p = getGoogleIdToken();
    await Promise.resolve();
    const rejection = expect(p).rejects.toThrow('popup blocked');
    jest.advanceTimersByTime(POPUP_OPEN_TIMEOUT_MS);
    await rejection;
  });

  it('팝업이 뜨기 전의 focus 이벤트는 취소로 세지 않는다', async () => {
    const { getGoogleIdToken, CANCEL_GRACE_MS } = await loadModule();
    const p = getGoogleIdToken();
    await Promise.resolve();
    window.dispatchEvent(new Event('focus'));
    jest.advanceTimersByTime(CANCEL_GRACE_MS);
    await expectPending(p);
    window.dispatchEvent(new Event('blur'));
    credentialCallback({ credential: 'late-token' });
    await expect(p).resolves.toBe('late-token');
  });
});
