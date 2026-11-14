import { fireEvent, render } from '@testing-library/react-native';

import { ChatPhotoCrop, fitRect } from '@/components/chat/chat-photo-crop';

const photo = { uri: 'file:///wide.jpg', name: 'wide.jpg', type: 'image/jpeg', width: 800, height: 400 }; // prettier-ignore

describe('ChatPhotoCrop', () => {
  it('사진을 무대 안에 비율대로 맞춰 놓는다', () => {
    // 2:1 사진을 300×300 무대에 — 폭을 채우고 세로 가운데.
    expect(fitRect({ width: 300, height: 300 }, 2)).toEqual({
      left: 0,
      top: 75,
      width: 300,
      height: 150,
    });
    // 1:2 사진은 높이를 채우고 가로 가운데.
    expect(fitRect({ width: 300, height: 300 }, 0.5)).toEqual({
      left: 75,
      top: 0,
      width: 150,
      height: 300,
    });
    expect(fitRect({ width: 0, height: 0 }, 2).width).toBe(0);
  });

  it('손대지 않고 완료하면 자르지 않는다', async () => {
    const onDone = jest.fn();
    const ui = await render(<ChatPhotoCrop photo={photo} onDone={onDone} onCancel={jest.fn()} />);
    await fireEvent.press(ui.getByText('완료'));
    expect(onDone).toHaveBeenCalledWith(undefined);
  });

  it('비율을 고르면 가운데 영역으로, 원본을 누르면 다시 전체로', async () => {
    const onDone = jest.fn();
    const ui = await render(<ChatPhotoCrop photo={photo} onDone={onDone} onCancel={jest.fn()} />);
    await fireEvent.press(ui.getByLabelText('1:1 비율로 자르기'));
    await fireEvent.press(ui.getByText('완료'));
    expect(onDone).toHaveBeenLastCalledWith({ x: 0.25, y: 0, width: 0.5, height: 1 });
    await fireEvent.press(ui.getByText('원본'));
    await fireEvent.press(ui.getByText('완료'));
    expect(onDone).toHaveBeenLastCalledWith(undefined);
  });

  it('이미 자른 사진을 다시 열면 그 영역에서 시작한다', async () => {
    const onDone = jest.fn();
    const crop = { x: 0.1, y: 0.2, width: 0.5, height: 0.5 };
    const ui = await render(
      <ChatPhotoCrop photo={{ ...photo, crop }} onDone={onDone} onCancel={jest.fn()} />,
    );
    await fireEvent.press(ui.getByText('완료'));
    expect(onDone).toHaveBeenCalledWith(crop);
  });

  it('사진이 없으면 그리지 않고, 취소는 onCancel만 부른다', async () => {
    const onDone = jest.fn();
    const onCancel = jest.fn();
    const ui = await render(<ChatPhotoCrop photo={null} onDone={onDone} onCancel={onCancel} />);
    expect(ui.queryByTestId('chat-photo-crop')).toBeNull();
    await ui.rerender(<ChatPhotoCrop photo={photo} onDone={onDone} onCancel={onCancel} />);
    await fireEvent.press(ui.getByText('취소'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });
});
