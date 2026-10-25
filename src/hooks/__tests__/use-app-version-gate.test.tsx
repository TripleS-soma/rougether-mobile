import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { useAppVersionGate } from '@/hooks/use-app-version-gate';
import { fetchVersionGate, installedRuntime } from '@/lib/app-version-gate';
import { loadDismissedVersion, saveDismissedVersion } from '@/lib/version-gate-store';
import { queryWrapper } from '@/test-utils/query-wrapper';

const STALE = 'a'.repeat(40);
const BLOCKED = 'b'.repeat(40);

let mockStatus: 'loading' | 'authed' | 'guest' = 'authed';
let mockUserId: number | undefined = 7;
jest.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ status: mockStatus }) }));
jest.mock('@/api', () => ({ getSessionUserId: () => mockUserId }));
jest.mock('@/lib/app-version-gate', () => ({
  fetchVersionGate: jest.fn(),
  installedRuntime: jest.fn(),
  decideVersionGate: jest.requireActual('@/lib/app-version-gate').decideVersionGate,
}));
jest.mock('@/lib/version-gate-store', () => ({
  loadDismissedVersion: jest.fn(async () => undefined),
  saveDismissedVersion: jest.fn(async () => {}),
}));

const fetchMock = fetchVersionGate as jest.MockedFunction<typeof fetchVersionGate>;
const runtimeMock = installedRuntime as jest.MockedFunction<typeof installedRuntime>;
const loadMock = loadDismissedVersion as jest.MockedFunction<typeof loadDismissedVersion>;
const saveMock = saveDismissedVersion as jest.MockedFunction<typeof saveDismissedVersion>;

function serve(config: Partial<Parameters<typeof jest.fn>[0]> | object) {
  fetchMock.mockResolvedValue({
    latestVersion: '1.5.4',
    staleRuntimes: [STALE],
    blockedRuntimes: [BLOCKED],
    ...config,
  } as never);
}

beforeEach(() => {
  mockStatus = 'authed';
  mockUserId = 7;
  fetchMock.mockReset();
  runtimeMock.mockReset();
  loadMock.mockReset().mockResolvedValue(undefined);
  saveMock.mockReset().mockResolvedValue(undefined);
  serve({});
});

// 이 저장소의 RNTL 설정은 비동기 렌더다 — `await` 없이는 결과가 undefined다.
async function mount() {
  return renderHook(() => useAppVersionGate(), { wrapper: queryWrapper() });
}

describe('useAppVersionGate', () => {
  it('목록에 없는 지문은 안내하지 않는다', async () => {
    runtimeMock.mockReturnValue('c'.repeat(40));
    const { result } = await mount();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(result.current.verdict.level).toBe('ok');
  });

  it('stale 지문이면 안내하고, 나중에를 누르면 버전을 기억한다', async () => {
    runtimeMock.mockReturnValue(STALE);
    const { result } = await mount();
    await waitFor(() => expect(result.current.verdict.level).toBe('recommended'));
    await act(async () => result.current.later());
    expect(result.current.verdict.level).toBe('ok');
    expect(saveMock).toHaveBeenCalledWith(7, '1.5.4');
  });

  it('막는 판정은 미룰 수 없다', async () => {
    runtimeMock.mockReturnValue(BLOCKED);
    const { result } = await mount();
    await waitFor(() => expect(result.current.verdict.level).toBe('blocked'));
    await act(async () => result.current.later());
    // 'later'를 불러도 막는 판정은 그대로여야 한다.
    expect(result.current.verdict.level).toBe('blocked');
  });

  it('같은 버전을 이미 미뤘으면 안 띄우고, 새 버전이 나오면 다시 띄운다', async () => {
    runtimeMock.mockReturnValue(STALE);
    loadMock.mockResolvedValue('1.5.4');
    const first = await mount();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(first.result.current.verdict.level).toBe('ok'));

    // 같은 설치본인데 원격의 최신 버전이 올라갔다 — 다시 안내해야 한다.
    serve({ latestVersion: '1.6.0' });
    const second = await mount();
    await waitFor(() => expect(second.result.current.verdict.level).toBe('recommended'));
    expect(second.result.current.verdict.latestVersion).toBe('1.6.0');
  });

  it('로그인 전에는 세션 안에서만 기억한다 — 저장하지 않는다', async () => {
    mockStatus = 'guest';
    mockUserId = undefined;
    runtimeMock.mockReturnValue(STALE);
    const { result } = await mount();
    await waitFor(() => expect(result.current.verdict.level).toBe('recommended'));
    await act(async () => result.current.later());
    expect(result.current.verdict.level).toBe('ok');
    // 계정이 없으면 계정별 키를 만들 수 없다 — 저장은 건너뛴다.
    expect(saveMock).toHaveBeenCalledWith(undefined, '1.5.4');
  });

  it('세션 복원이 늦어도 그때의 userId로 기억을 읽는다', async () => {
    // getSessionUserId는 비반응형이라, useAuth 구독 없이는 undefined로 굳어
    // 지난 세션의 미루기 기억이 영영 안 읽힌다.
    mockStatus = 'loading';
    mockUserId = undefined;
    runtimeMock.mockReturnValue(STALE);
    const { result, rerender } = await mount();
    await waitFor(() => expect(loadMock).toHaveBeenCalledWith(undefined));

    mockStatus = 'authed';
    mockUserId = 42;
    await act(async () => rerender(undefined));
    await waitFor(() => expect(loadMock).toHaveBeenCalledWith(42));
    await act(async () => result.current.later());
    expect(saveMock).toHaveBeenCalledWith(42, '1.5.4');
  });

  it("로그인 화면에서 누른 '나중에'가 로그인한 계정으로 넘어가지 않는다", async () => {
    // 지속 저장은 계정별인데(#1298) 세션 기억까지 계정 단위여야 한다 —
    // 단일 불리언이면 게스트의 '나중에'가 로그인 후에도 시트를 덮는다.
    mockStatus = 'guest';
    mockUserId = undefined;
    runtimeMock.mockReturnValue(STALE);
    loadMock.mockResolvedValue(undefined);
    const { result, rerender } = await mount();
    await waitFor(() => expect(result.current.verdict.level).toBe('recommended'));
    await act(async () => result.current.later());
    expect(result.current.verdict.level).toBe('ok');

    mockStatus = 'authed';
    mockUserId = 7;
    await act(async () => rerender(undefined));
    await waitFor(() => expect(result.current.verdict.level).toBe('recommended'));
  });

  it('기억을 읽기 전에는 안 띄운다 — 이미 미룬 사람의 시트 깜빡임', async () => {
    // 원격 조회가 AsyncStorage 읽기보다 빠르면, 기억을 모르는 채로 recommended가
    // 나와 시트가 떴다 닫힌다.
    runtimeMock.mockReturnValue(STALE);
    let release: (v: string | undefined) => void = () => {};
    loadMock.mockReturnValue(new Promise((resolve) => (release = resolve)));
    const { result } = await mount();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(result.current.verdict.level).toBe('ok');
    await act(async () => release('1.5.4'));
    expect(result.current.verdict.level).toBe('ok');
  });

  it('계정이 바뀌면 새 계정의 기억을 읽기 전까지 띄우지 않는다', async () => {
    // 앞 계정은 안 미뤄서 시트가 떠 있다. 계정이 바뀌는 순간 들고 있던 기억은
    // 앞 계정 것이므로, 새 계정의 값을 읽기 전에 그걸로 판정하면 안 된다.
    runtimeMock.mockReturnValue(STALE);
    loadMock.mockResolvedValue(undefined);
    const { result, rerender } = await mount();
    await waitFor(() => expect(result.current.verdict.level).toBe('recommended'));

    let release: (v: string | undefined) => void = () => {};
    loadMock.mockReturnValue(new Promise((resolve) => (release = resolve)));
    mockUserId = 8;
    await act(async () => rerender(undefined));
    expect(result.current.verdict.level).toBe('ok');

    // 새 계정이 이미 미뤘다면 끝까지 안 뜬다.
    await act(async () => release('1.5.4'));
    expect(result.current.verdict.level).toBe('ok');
  });

  it('스토어 앱이 안 열리면 웹 주소로 떨어뜨린다', async () => {
    runtimeMock.mockReturnValue(STALE);
    const openSpy = jest
      .spyOn(Linking, 'openURL')
      .mockRejectedValueOnce(new Error('no handler'))
      .mockResolvedValueOnce(true);
    const { result } = await mount();
    await waitFor(() => expect(result.current.verdict.level).toBe('recommended'));
    await act(async () => result.current.openStore());
    await waitFor(() => expect(openSpy).toHaveBeenCalledTimes(2));
    expect(openSpy.mock.calls[1]?.[0]).toContain('https://');
    openSpy.mockRestore();
  });

  it('조회가 실패하면 통과시킨다', async () => {
    runtimeMock.mockReturnValue(STALE);
    fetchMock.mockRejectedValue(new Error('offline'));
    const { result } = await mount();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(result.current.verdict.level).toBe('ok');
  });
});
