import { fireEvent, render } from '@testing-library/react-native';

import { AppUpdateCard } from '@/components/ui/app-update-card';
import type { AppUpdateState, AppUpdateStatus } from '@/types/app-update';

const info: AppUpdateState['info'] = {
  appVersion: '1.4.0',
  channel: 'preview',
  runtimeVersion: 'native-runtime',
  updateId: 'running-update-id',
  embedded: false,
  emergencyLaunch: false,
};

it('checks on demand and does not show apply before downloading', async () => {
  const onCheck = jest.fn();
  const onApply = jest.fn();
  const { getByLabelText, queryByLabelText } = await render(
    <AppUpdateCard state={{ status: 'idle', info }} onCheck={onCheck} onApply={onApply} />,
  );
  expect(queryByLabelText('지금 적용')).toBeNull();
  await fireEvent.press(getByLabelText('업데이트 확인'));
  expect(onCheck).toHaveBeenCalledTimes(1);
  expect(onApply).not.toHaveBeenCalled();
});

it('requires confirmation to apply and cancels without restarting', async () => {
  const onApply = jest.fn();
  const { getByLabelText, getByText, queryByText } = await render(
    <AppUpdateCard state={{ status: 'ready', info }} onApply={onApply} />,
  );
  await fireEvent.press(getByLabelText('지금 적용'));
  expect(onApply).not.toHaveBeenCalled();
  expect(getByText(/저장하지 않은 작업/)).toBeTruthy();
  await fireEvent.press(getByLabelText('나중에'));
  expect(onApply).not.toHaveBeenCalled();
  expect(queryByText('업데이트를 지금 적용할까요?')).toBeNull();
  await fireEvent.press(getByLabelText('지금 적용'));
  await fireEvent.press(getByLabelText('업데이트 적용 확인'));
  expect(onApply).toHaveBeenCalledTimes(1);
});

it.each([
  ['checking', '확인 중'],
  ['downloading', '다운로드 중'],
  ['applying', '적용 중'],
  ['unsupported', '이 환경에서는 지원 안 함'],
] as [AppUpdateStatus, string][])('disables actions while %s', async (status, label) => {
  const action = jest.fn();
  const { getByLabelText } = await render(
    <AppUpdateCard state={{ status, info }} onCheck={action} onApply={action} />,
  );
  expect(getByLabelText(label)).toBeDisabled();
  await fireEvent.press(getByLabelText(label));
  expect(action).not.toHaveBeenCalled();
});

it('shows a scoped no-update message, not a store latest-version claim', async () => {
  const { getByText, queryByText } = await render(
    <AppUpdateCard state={{ status: 'no-update', info }} onCheck={jest.fn()} />,
  );
  expect(getByText(/현재 앱과 호환되는 새 업데이트가 없어요/)).toBeTruthy();
  expect(getByText(/스토어의 앱 업데이트는 별도로/)).toBeTruthy();
  expect(queryByText('최신 버전이에요')).toBeNull();
});

it('shows download progress and a retryable failure without hiding diagnostics', async () => {
  const { getByText, getByLabelText, rerender } = await render(
    <AppUpdateCard state={{ status: 'downloading', progress: 0.42, info }} />,
  );
  expect(getByText(/42%/)).toBeTruthy();
  await rerender(
    <AppUpdateCard
      state={{ status: 'error', error: '연결을 확인해 주세요.', info }}
      onCheck={jest.fn()}
    />,
  );
  expect(getByText('연결을 확인해 주세요.')).toBeTruthy();
  expect(getByLabelText('다시 시도')).not.toBeDisabled();
  await fireEvent.press(getByLabelText('업데이트 정보'));
  expect(getByText('preview')).toBeTruthy();
  expect(getByText('native-runtime')).toBeTruthy();
  expect(getByText('running-update-id')).toBeTruthy();
  expect(getByText('다운로드한 업데이트')).toBeTruthy();
});

it('shows emergency fallback and unknown identifiers honestly', async () => {
  const { getByLabelText, getByText, getAllByText } = await render(
    <AppUpdateCard
      state={{
        status: 'unsupported',
        info: {
          ...info,
          channel: null,
          runtimeVersion: null,
          updateId: null,
          embedded: true,
          emergencyLaunch: true,
        },
      }}
    />,
  );
  await fireEvent.press(getByLabelText('업데이트 정보'));
  expect(getAllByText('확인 불가')).toHaveLength(3);
  expect(getByText('앱에 포함된 기본 코드')).toBeTruthy();
  expect(getByText(/기본 코드로 복구했어요/)).toBeTruthy();
});
