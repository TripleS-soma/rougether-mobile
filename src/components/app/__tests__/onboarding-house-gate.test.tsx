import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { fetchHouse } from '@/api/houses';
import { ApiError } from '@/api/http';
import { fetchOnboardingHouse, saveOnboardingHouse } from '@/api/onboarding';
import { OnboardingHouseGate } from '@/components/app/onboarding-house-gate';
import { ToastProvider } from '@/components/ui/toast';
import { track } from '@/lib/analytics';

jest.mock('@/api/onboarding', () => ({
  fetchOnboardingHouse: jest.fn(),
  saveOnboardingHouse: jest.fn(),
}));
jest.mock('@/api/houses', () => ({ fetchHouse: jest.fn() }));
jest.mock('@/lib/analytics', () => ({
  ...jest.requireActual('@/lib/analytics'),
  track: jest.fn(),
}));
const fetchMock = fetchOnboardingHouse as jest.MockedFunction<typeof fetchOnboardingHouse>;
const saveMock = saveOnboardingHouse as jest.MockedFunction<typeof saveOnboardingHouse>;
const houseMock = fetchHouse as jest.MockedFunction<typeof fetchHouse>;
const trackMock = track as jest.MockedFunction<typeof track>;

const renderGate = async (onFinish = jest.fn(async () => {})) => ({
  onFinish,
  ui: await render(
    <ToastProvider>
      <OnboardingHouseGate onFinish={onFinish} />
    </ToastProvider>,
  ),
});

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({ completed: false });
  saveMock.mockReset();
  houseMock.mockReset();
  trackMock.mockClear();
});

describe('OnboardingHouseGate (#1407)', () => {
  it('서버에 이미 선택이 있으면 화면 없이 통과한다 (재설치·다른 기기)', async () => {
    fetchMock.mockResolvedValue({ completed: true, choice: 'PERSONAL', result: 'PERSONAL' });
    const { onFinish } = await renderGate();
    await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
    expect(trackMock).not.toHaveBeenCalledWith('onboarding_house_view');
  });

  it('괜찮아요는 카드 없이 통과하고, 매칭 실패는 공개 전환 카드를 보여준다', async () => {
    saveMock.mockResolvedValueOnce({ completed: true, choice: 'PERSONAL', result: 'PERSONAL' });
    const first = await renderGate();
    await waitFor(() => expect(trackMock).toHaveBeenCalledWith('onboarding_house_view'));
    await fireEvent.press(first.ui.getByText('괜찮아요'));
    await waitFor(() => expect(first.onFinish).toHaveBeenCalledTimes(1));
    expect(trackMock).toHaveBeenCalledWith('onboarding_house_choice', {
      choice: 'PERSONAL',
      result: 'PERSONAL',
    });
    await first.ui.unmount();

    saveMock.mockResolvedValueOnce({
      completed: true,
      choice: 'AUTO_JOIN',
      result: 'NO_MATCH',
      houseId: 9,
    });
    const second = await renderGate();
    await fireEvent.press(second.ui.getByText('좋아요'));
    await waitFor(() => expect(second.ui.getByText('아직 함께할 집이 없어요')).toBeTruthy());
    expect(second.onFinish).not.toHaveBeenCalled();
    await fireEvent.press(second.ui.getByText('계속'));
    await waitFor(() => expect(second.onFinish).toHaveBeenCalledTimes(1));
  });

  it('합류하면 집 상세로 이름·인원을 채우고, 상세 조회가 실패해도 합류 카드는 뜬다', async () => {
    saveMock.mockResolvedValue({
      completed: true,
      choice: 'AUTO_JOIN',
      result: 'JOINED',
      houseId: 42,
    });
    houseMock.mockResolvedValueOnce({ houseId: 42, name: '아침형 인간들', currentMemberCount: 3 });
    const first = await renderGate();
    await fireEvent.press(first.ui.getByText('좋아요'));
    await waitFor(() => expect(first.ui.getByText("'아침형 인간들'에 합류했어요!")).toBeTruthy());
    await first.ui.unmount();

    houseMock.mockRejectedValueOnce(new Error('offline'));
    const second = await renderGate();
    await fireEvent.press(second.ui.getByText('좋아요'));
    await waitFor(() => expect(second.ui.getByText('새 집에 합류했어요!')).toBeTruthy());
  });

  it('이미 골라둔 계정의 409는 조용히 통과하고, 그 외 실패는 안내 뒤 통과한다', async () => {
    saveMock.mockRejectedValueOnce(
      new ApiError(409, 'PUT', '/onboarding/house', '{"code":"ONBOARDING_HOUSE_ALREADY_SELECTED"}'),
    );
    const first = await renderGate();
    await fireEvent.press(first.ui.getByText('좋아요'));
    await waitFor(() => expect(first.onFinish).toHaveBeenCalledTimes(1));
    expect(
      first.ui.queryByText('집을 정하지 못했어요. 집 탭에서 다시 시도할 수 있어요.'),
    ).toBeNull();
    await first.ui.unmount();

    saveMock.mockRejectedValueOnce(new ApiError(500, 'PUT', '/onboarding/house'));
    const second = await renderGate();
    await fireEvent.press(second.ui.getByText('괜찮아요'));
    await waitFor(() => expect(second.onFinish).toHaveBeenCalledTimes(1));
    expect(
      second.ui.getByText('집을 정하지 못했어요. 집 탭에서 다시 시도할 수 있어요.'),
    ).toBeTruthy();
  });
});
