import { act, renderHook, waitFor } from '@testing-library/react-native';

import { createRoutine, fetchCategories, fetchRoutines, getSessionUserId } from '@/api';
import { useStarterRoutine } from '@/hooks/use-starter-routine';
import { recommendStarterRoutines } from '@/constants/starter-routines';
import { track } from '@/lib/analytics';
import { queryWrapper } from '@/test-utils/query-wrapper';

jest.mock('@/api', () => ({
  createRoutine: jest.fn(),
  fetchRoutines: jest.fn(),
  fetchCategories: jest.fn(),
  getSessionUserId: jest.fn(),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
const template = recommendStarterRoutines([{ id: 'reading', label: '독서' }])[0];

describe('첫 루틴 저장', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getSessionUserId).mockReturnValue(7);
    jest.mocked(fetchRoutines).mockResolvedValue([]);
    jest.mocked(fetchCategories).mockResolvedValue([{ id: 90, name: '취미' }]);
    jest.mocked(createRoutine).mockResolvedValue({ id: 12, title: template.title });
  });

  it('체크·매일·알림 없음으로 생성하고 KST 오늘은 서버 기본값을 사용한다', async () => {
    const { result } = await renderHook(() => useStarterRoutine(7), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      expect(await result.current.start(template)).toBe('created');
    });
    expect(createRoutine).toHaveBeenCalledWith({
      title: '책 2쪽 읽기',
      categoryId: 90,
      authType: 'CHECK',
      repeatType: 'DAILY',
    });
    expect(track).toHaveBeenCalledWith('routine_create', {
      kind: 'routine',
      source: 'onboarding',
      template_id: template.id,
    });
  });

  it('리렌더 전 연속 탭도 한 요청으로 잠근다', async () => {
    const { result } = await renderHook(() => useStarterRoutine(7), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await Promise.all([result.current.start(template), result.current.start(template)]);
    });
    expect(createRoutine).toHaveBeenCalledTimes(1);
  });

  it('이미 루틴이 생겼으면 POST 없이 기존 루틴으로 들어간다', async () => {
    const { result } = await renderHook(() => useStarterRoutine(7), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    jest.mocked(fetchRoutines).mockResolvedValue([{ id: 12 }]);
    await act(async () => {
      expect(await result.current.start(template)).toBe('existing');
    });
    expect(createRoutine).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalledWith('routine_create', expect.anything());
  });

  it('응답 유실 후에는 자동 POST 재시도 없이 서버를 다시 조회한다', async () => {
    jest.mocked(createRoutine).mockRejectedValue(new Error('response lost'));
    const { result } = await renderHook(() => useStarterRoutine(7), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      expect(await result.current.start(template)).toBeNull();
    });
    await waitFor(() => expect(result.current.needsReload).toBe(true));
    jest.mocked(fetchRoutines).mockResolvedValue([{ id: 12 }]);
    await act(async () => {
      await result.current.reload();
    });
    await waitFor(() => expect(result.current.existing).toBe(true));
    expect(createRoutine).toHaveBeenCalledTimes(1);
    expect(track).not.toHaveBeenCalledWith('routine_create', expect.anything());
  });

  it('목록 오류를 빈 계정으로 간주하지 않으며 저장 전 계정 변경을 막는다', async () => {
    jest.mocked(fetchRoutines).mockRejectedValue(new Error('offline'));
    const { result } = await renderHook(() => useStarterRoutine(7), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.needsReload).toBe(true));
    expect(result.current.existing).toBe(false);
    jest.mocked(getSessionUserId).mockReturnValue(8);
    await act(async () => {
      expect(await result.current.start(template)).toBeNull();
    });
    expect(createRoutine).not.toHaveBeenCalled();
  });

  it('일치하는 카테고리가 없어도 별도 카테고리 생성 폼 없이 등록한다', async () => {
    jest.mocked(fetchCategories).mockResolvedValue([{ id: 90, name: '취미', houseId: 33 }]);
    const { result } = await renderHook(() => useStarterRoutine(7), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.start(template);
    });
    expect(createRoutine).toHaveBeenCalledWith(expect.objectContaining({ categoryId: undefined }));
  });
});
