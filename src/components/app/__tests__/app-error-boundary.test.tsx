import { fireEvent, render } from '@testing-library/react-native';
import { useState } from 'react';
import { Text } from 'react-native';

import { AppErrorBoundary } from '@/components/app/app-error-boundary';

// 렌더 예외는 흰 화면 대신 복구 화면으로, "다시 시도"로 트리를 새로 그린다 (#1376).
describe('AppErrorBoundary', () => {
  let shouldThrow = true;
  function Flaky() {
    const [label] = useState('정상 화면');
    if (shouldThrow) throw new Error('render boom');
    return <Text>{label}</Text>;
  }

  beforeEach(() => {
    shouldThrow = true;
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it('자식이 렌더 중 던지면 복구 화면을 보여 주고, 다시 시도로 회복한다', async () => {
    const ui = await render(
      <AppErrorBoundary>
        <Flaky />
      </AppErrorBoundary>,
    );
    expect(ui.getByText('문제가 생겼어요')).toBeTruthy();

    shouldThrow = false;
    await fireEvent.press(ui.getByLabelText('다시 시도'));
    expect(ui.getByText('정상 화면')).toBeTruthy();
  });

  it('예외가 없으면 자식을 그대로 그린다', async () => {
    shouldThrow = false;
    const ui = await render(
      <AppErrorBoundary>
        <Flaky />
      </AppErrorBoundary>,
    );
    expect(ui.getByText('정상 화면')).toBeTruthy();
    expect(ui.queryByText('문제가 생겼어요')).toBeNull();
  });
});
