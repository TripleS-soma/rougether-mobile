/**
 * @jest-environment jsdom
 *
 * 구글 웹 로그인 배선 (#1225 → #1532) — GIS 스크립트는 로드하지 않고
 * `window.google.accounts.id` 스텁을 모듈 로드 전에 심는다(모듈이 로드 시점에
 * `ensureReady()`를 미리 부른다).
 *
 * 스텁의 `renderButton`은 **지금의 GIS처럼 iframe만** 그린다. 예전 스텁은
 * `div[role=button]`을 그려, GIS가 iframe으로 바뀌어 웹 구글 로그인이 통째로 막힌
 * 것(#1532)을 테스트가 못 잡았다.
 */
import { URL as NodeURL, URLSearchParams as NodeURLSearchParams } from 'node:url';

// jest-expo 프리셋이 RN의 URL·URLSearchParams 스텁을 전역에 심는다(객체 인자를
// 받으면 throw). 브라우저 배선 테스트는 실제 구현이 필요해 Node 것으로 되돌린다.
beforeAll(() => {
  Object.assign(globalThis, { URL: NodeURL, URLSearchParams: NodeURLSearchParams });
});

type GoogleAuthWeb = typeof import('@/lib/google-auth.web');
type Moment = {
  isSkippedMoment?: () => boolean;
  isDismissedMoment?: () => boolean;
  getDismissedReason?: () => string;
};

let credentialCallback: (res: { credential?: string }) => void = () => {};
let promptListener: ((moment: Moment) => void) | undefined;
const renderButton = jest.fn((parent: HTMLElement) => {
  // 지금의 GIS: 버튼은 구글 도메인 iframe 안에 있다 — 페이지에서 누를 수 없다.
  parent.appendChild(document.createElement('iframe'));
});
const prompt = jest.fn((listener?: (moment: Moment) => void) => {
  promptListener = listener;
});
const disableAutoSelect = jest.fn();

function installGoogleStub() {
  (window as Window & { google?: unknown }).google = {
    accounts: {
      id: {
        initialize: (cfg: { callback: typeof credentialCallback }) => {
          credentialCallback = cfg.callback;
        },
        renderButton,
        prompt,
        disableAutoSelect,
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
  // 모듈 로드 시 시작한 ensureReady()가 initialize까지.
  await Promise.resolve();
  await Promise.resolve();
  return mod;
}

beforeEach(() => {
  renderButton.mockClear();
  prompt.mockClear();
  promptListener = undefined;
});

describe('공식 구글 버튼 (#1532)', () => {
  it('사용자가 공식 버튼(iframe)을 눌러 받은 credential로 로그인 흐름이 토큰을 얻는다', async () => {
    const { getGoogleIdToken, onGoogleCredential } = await loadModule();
    const started = jest.fn();
    onGoogleCredential(started);

    credentialCallback({ credential: 'id-token' });

    expect(started).toHaveBeenCalledTimes(1);
    await expect(getGoogleIdToken()).resolves.toBe('id-token');
    // 받아 둔 credential은 1회용 — 다음 요청이 같은 토큰을 다시 쓰지 않는다.
    expect(prompt).not.toHaveBeenCalled();
  });

  it('공식 버튼을 자리 폭(200~400px)·테마·언어에 맞춰 그린다', async () => {
    const { mountGoogleButton } = await loadModule();
    const parent = document.createElement('div');
    parent.appendChild(document.createElement('span'));

    await mountGoogleButton(parent, { width: 520.4, theme: 'filled_black', locale: 'ko' });

    expect(renderButton).toHaveBeenCalledWith(
      parent,
      expect.objectContaining({
        width: 400,
        theme: 'filled_black',
        locale: 'ko',
        text: 'continue_with',
      }),
    );
    // 다시 그릴 때 이전 버튼을 비운다.
    expect(parent.querySelector('span')).toBeNull();
    await mountGoogleButton(parent, { width: 120, theme: 'outline', locale: 'en' });
    expect(renderButton).toHaveBeenLastCalledWith(parent, expect.objectContaining({ width: 200 }));
  });

  it('구독을 풀면 더는 로그인 흐름을 시작하지 않는다', async () => {
    const { onGoogleCredential } = await loadModule();
    const started = jest.fn();
    const off = onGoogleCredential(started);
    off();
    credentialCallback({ credential: 'id-token' });
    expect(started).not.toHaveBeenCalled();
  });
});

describe('받아 둔 credential이 없을 때 — One Tap 대체 경로', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('One Tap으로 받은 credential을 돌려준다(공식 버튼 구독자는 부르지 않는다)', async () => {
    const { getGoogleIdToken, onGoogleCredential } = await loadModule();
    const started = jest.fn();
    onGoogleCredential(started);
    const p = getGoogleIdToken();
    await Promise.resolve();
    await Promise.resolve();
    expect(prompt).toHaveBeenCalledTimes(1);
    // 성공으로 닫힐 때의 dismissed는 취소가 아니다.
    promptListener?.({
      isDismissedMoment: () => true,
      getDismissedReason: () => 'credential_returned',
    });
    credentialCallback({ credential: 'one-tap-token' });
    await expect(p).resolves.toBe('one-tap-token');
    expect(started).not.toHaveBeenCalled();
  });

  it('One Tap을 건너뛰거나 닫으면 null(취소)', async () => {
    const { getGoogleIdToken } = await loadModule();
    const skipped = getGoogleIdToken();
    await Promise.resolve();
    await Promise.resolve();
    promptListener?.({ isSkippedMoment: () => true });
    await expect(skipped).resolves.toBeNull();

    const dismissed = getGoogleIdToken();
    await Promise.resolve();
    await Promise.resolve();
    promptListener?.({ isDismissedMoment: () => true, getDismissedReason: () => 'cancel_called' });
    await expect(dismissed).resolves.toBeNull();
  });

  it('아무 응답이 없어도 영원히 기다리지 않는다', async () => {
    const { getGoogleIdToken, PROMPT_TIMEOUT_MS } = await loadModule();
    const p = getGoogleIdToken();
    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(PROMPT_TIMEOUT_MS);
    await expect(p).resolves.toBeNull();
  });
});

it('로그아웃은 자동 선택만 끈다', async () => {
  const { signOutGoogle } = await loadModule();
  await signOutGoogle();
  expect(disableAutoSelect).toHaveBeenCalled();
});
