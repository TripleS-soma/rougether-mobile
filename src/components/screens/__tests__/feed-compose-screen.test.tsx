import { fireEvent, render } from '@testing-library/react-native';

import { FeedComposeScreen } from '@/components/screens/feed-compose-screen';
import type { FeedDraftImage } from '@/components/screens/feed/types';
import { DEMO_FEED_COMPLETIONS, DEMO_FEED_TODAY } from '@/mocks/fixtures';

const done = (key: string, imageId: number): FeedDraftImage => ({
  key,
  uri: '',
  status: 'done',
  imageId,
});

describe('FeedComposeScreen (#1409)', () => {
  it('인증게시판은 사진이 없으면 올리기가 꺼져 있고 안내가 보인다', async () => {
    const onSubmit = jest.fn();
    const { getByLabelText, getByText } = await render(
      <FeedComposeScreen board="VERIFICATION" content="본문만" onSubmit={onSubmit} />,
    );
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

  it('기본은 자유게시판 — 사진 없이 본문만 있으면 올릴 수 있다', async () => {
    const onSubmit = jest.fn();
    const ui = await render(<FeedComposeScreen onSubmit={onSubmit} />);
    expect(ui.getByLabelText('자유 게시판').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(ui.getByText('본문을 쓰거나 사진을 골라 주세요.')).toBeTruthy();
    expect(ui.getByLabelText('올리기').props.accessibilityState).toMatchObject({ disabled: true });

    await ui.rerender(<FeedComposeScreen content="   " onSubmit={onSubmit} />);
    expect(ui.getByLabelText('올리기').props.accessibilityState).toMatchObject({ disabled: true });

    await ui.rerender(<FeedComposeScreen content="글만 올려요" onSubmit={onSubmit} />);
    await fireEvent.press(ui.getByLabelText('올리기'));
    expect(onSubmit).toHaveBeenCalled();
  });

  it('게시판을 누르면 그 게시판으로 바꾼다', async () => {
    const onChangeBoard = jest.fn();
    const { getByLabelText } = await render(<FeedComposeScreen onChangeBoard={onChangeBoard} />);
    await fireEvent.press(getByLabelText('인증 게시판'));
    expect(onChangeBoard).toHaveBeenCalledWith('VERIFICATION');
  });

  describe('인증할 루틴 고르기 (서버 #430)', () => {
    const picker = { groups: DEMO_FEED_COMPLETIONS, loading: false, error: false };

    it('사진이 있어도 루틴을 고르기 전엔 올리기가 꺼져 있고 안내가 보인다', async () => {
      const onChangeRoutine = jest.fn();
      const ui = await render(
        <FeedComposeScreen
          board="VERIFICATION"
          images={[done('a', 1)]}
          routinePicker={picker}
          onChangeRoutine={onChangeRoutine}
          today={DEMO_FEED_TODAY}
          onSubmit={() => {}}
        />,
      );
      expect(ui.getByLabelText('올리기').props.accessibilityState).toMatchObject({
        disabled: true,
      });
      expect(ui.getByText('인증할 루틴을 골라 주세요.')).toBeTruthy();
      await fireEvent.press(ui.getByLabelText('물 2L 마시기, 10/4 완료'));
      expect(onChangeRoutine).toHaveBeenCalledWith({ routineId: 16, date: '2026-10-04' });

      await ui.rerender(
        <FeedComposeScreen
          board="VERIFICATION"
          images={[done('a', 1)]}
          routinePicker={picker}
          routine={{ routineId: 16, date: '2026-10-04' }}
          today={DEMO_FEED_TODAY}
          onSubmit={() => {}}
        />,
      );
      expect(ui.getByLabelText('올리기').props.accessibilityState).toMatchObject({
        disabled: false,
      });
      expect(ui.getByLabelText('물 2L 마시기, 10/4 완료').props.accessibilityState).toMatchObject({
        checked: true,
      });
    });

    it('날짜별로 오늘·어제·M/D로 묶는다', async () => {
      const ui = await render(
        <FeedComposeScreen board="VERIFICATION" routinePicker={picker} today={DEMO_FEED_TODAY} />,
      );
      expect(ui.getByText('오늘')).toBeTruthy();
      expect(ui.getByText('어제')).toBeTruthy();
      expect(ui.getByText('10/1')).toBeTruthy();
      // 같은 루틴이라도 날짜가 다르면 따로 고른다.
      expect(ui.getByLabelText('아침 스트레칭, 10/4 완료')).toBeTruthy();
      expect(ui.getByLabelText('아침 스트레칭, 10/3 완료')).toBeTruthy();
    });

    it('최근 7일 완료가 없으면 빈 안내', async () => {
      const ui = await render(
        <FeedComposeScreen
          board="VERIFICATION"
          routinePicker={{ groups: [], loading: false, error: false }}
        />,
      );
      expect(ui.getByText('최근 7일 동안 완료한 루틴이 없어요')).toBeTruthy();
    });

    it('자유게시판에선 루틴 고르기를 그리지 않는다', async () => {
      const ui = await render(<FeedComposeScreen board="FREE" routinePicker={picker} />);
      expect(ui.queryByTestId('feed-routine-picker')).toBeNull();
    });
  });
});
