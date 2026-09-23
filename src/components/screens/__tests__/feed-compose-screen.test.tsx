import { fireEvent, render } from '@testing-library/react-native';

import { FeedComposeScreen } from '@/components/screens/feed-compose-screen';
import type { FeedDraftImage } from '@/components/screens/feed/types';

const done = (key: string, imageId: number): FeedDraftImage => ({
  key,
  uri: '',
  status: 'done',
  imageId,
});

describe('FeedComposeScreen (#1409)', () => {
  it('사진이 없으면 올리기가 꺼져 있고 안내가 보인다', async () => {
    const onSubmit = jest.fn();
    const { getByLabelText, getByText } = await render(<FeedComposeScreen onSubmit={onSubmit} />);
    const submit = getByLabelText('올리기');
    expect(submit.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(submit);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(getByText('사진을 한 장 이상 골라 주세요.')).toBeTruthy();
  });

  it('올리는 중인 사진이 있으면 꺼져 있고, 전부 올라가면 켜진다', async () => {
    const onSubmit = jest.fn();
    const ui = await render(
      <FeedComposeScreen
        images={[done('a', 1), { key: 'b', uri: '', status: 'uploading' }]}
        onSubmit={onSubmit}
      />,
    );
    expect(ui.getByLabelText('올리기').props.accessibilityState).toMatchObject({ disabled: true });

    await ui.rerender(<FeedComposeScreen images={[done('a', 1)]} onSubmit={onSubmit} />);
    await fireEvent.press(ui.getByLabelText('올리기'));
    expect(onSubmit).toHaveBeenCalled();
  });

  it('실패한 사진은 다시 올리기, 빼기는 그 사진 키로', async () => {
    const onRetryImage = jest.fn();
    const onRemoveImage = jest.fn();
    const { getByLabelText } = await render(
      <FeedComposeScreen
        images={[done('a', 1), { key: 'b', uri: '', status: 'failed', error: '실패' }]}
        onRetryImage={onRetryImage}
        onRemoveImage={onRemoveImage}
      />,
    );
    await fireEvent.press(getByLabelText('사진 2 다시 올리기'));
    expect(onRetryImage).toHaveBeenCalledWith('b');
    await fireEvent.press(getByLabelText('사진 1 빼기'));
    expect(onRemoveImage).toHaveBeenCalledWith('a');
  });

  it('본문은 2,000자에서 자르고 글자 수를 보인다', async () => {
    const onChangeContent = jest.fn();
    const { getByLabelText, getByText } = await render(
      <FeedComposeScreen content="안녕" onChangeContent={onChangeContent} />,
    );
    expect(getByText('2/2000')).toBeTruthy();
    const input = getByLabelText('본문');
    expect(input.props.maxLength).toBe(2000);
    await fireEvent.changeText(input, 'a'.repeat(2100));
    expect(onChangeContent).toHaveBeenCalledWith('a'.repeat(2000));
  });

  it('10장을 채우면 사진 추가 타일이 사라진다', async () => {
    const images = Array.from({ length: 10 }, (_, i) => done(`k${i}`, i + 1));
    const { queryByLabelText } = await render(<FeedComposeScreen images={images} />);
    expect(queryByLabelText(/사진 고르기/)).toBeNull();
  });
});
