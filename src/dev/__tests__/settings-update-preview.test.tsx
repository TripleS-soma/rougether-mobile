import { fireEvent, render } from '@testing-library/react-native';

import { SettingsUpdatePreview } from '@/dev/settings-update-preview';

it('connects settings to simulated updates and applies only after confirmation', async () => {
  const ui = await render(<SettingsUpdatePreview />);
  expect(ui.getByTestId('settings-preview-status')).toHaveTextContent(/적용 확인 0회/);
  await fireEvent.press(ui.getByRole('button', { name: '업데이트 확인' }));
  expect(ui.getByText('업데이트 준비 완료')).toBeTruthy();
  await fireEvent.press(ui.getByRole('button', { name: '지금 적용' }));
  await fireEvent.press(ui.getByRole('button', { name: '나중에' }));
  expect(ui.getByTestId('settings-preview-status')).toHaveTextContent(/적용 확인 0회/);
  await fireEvent.press(ui.getByRole('button', { name: '지금 적용' }));
  await fireEvent.press(ui.getByRole('button', { name: '업데이트 적용 확인' }));
  expect(ui.getByTestId('settings-preview-status')).toHaveTextContent(/적용 확인 1회/);
  expect(ui.getByRole('button', { name: '업데이트 확인' })).toBeTruthy();
});

it('exposes download, error and unsupported states without contacting the update service', async () => {
  const ui = await render(<SettingsUpdatePreview />);
  await fireEvent.press(ui.getByRole('button', { name: '미리보기 다운로드' }));
  expect(ui.getByText(/42%/)).toBeTruthy();
  await fireEvent.press(ui.getByRole('button', { name: '미리보기 오류' }));
  expect(ui.getByRole('alert')).toHaveTextContent(/연결 상태/);
  await fireEvent.press(ui.getByRole('button', { name: '미리보기 미지원' }));
  expect(ui.getByRole('button', { name: '이 환경에서는 지원 안 함' })).toBeDisabled();
});
