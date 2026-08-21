import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { BugReportScreen } from '@/components/screens/bug-report-screen';
import { ToastProvider } from '@/components/ui/toast';

describe('BugReportScreen', () => {
  it('renders the form and my report history with status badges (#496)', async () => {
    const { getByText, getByPlaceholderText } = await render(
      <BugReportScreen
        entries={[
          { id: 2, title: '달력 원 정렬이 어긋나요', status: 'IN_PROGRESS', date: '7월 20일' },
          { id: 1, title: '로그인이 안 돼요', status: 'RESOLVED', date: '7월 12일' },
        ]}
      />,
    );
    expect(getByText('버그 제보')).toBeTruthy();
    expect(getByPlaceholderText('어떤 문제가 있었나요?')).toBeTruthy();
    expect(getByText('내 제보 내역')).toBeTruthy();
    expect(getByText('달력 원 정렬이 어긋나요')).toBeTruthy();
    expect(getByText('처리 중')).toBeTruthy();
    expect(getByText('해결됨')).toBeTruthy();
  });

  it('shows an empty state without reports', async () => {
    const { getByText } = await render(<BugReportScreen entries={[]} />);
    expect(getByText('아직 제보한 내용이 없어요')).toBeTruthy();
  });

  it('submits title/content/images and clears the form on success', async () => {
    const onSubmit = jest.fn(async () => true);
    const onPickImage = jest.fn(async () => ({
      uri: 'file://shot.png',
      name: 'shot.png',
      type: 'image/png',
    }));
    const { getByText, getByLabelText, getByPlaceholderText } = await render(
      <ToastProvider>
        <BugReportScreen onSubmit={onSubmit} onPickImage={onPickImage} />
      </ToastProvider>,
    );

    await fireEvent.changeText(getByPlaceholderText('어떤 문제가 있었나요?'), '앱이 꺼져요');
    await fireEvent.changeText(
      getByPlaceholderText('발생 상황을 자세히 적어주시면 해결에 큰 도움이 돼요'),
      '방 화면에서 사진 저장을 누르면 꺼집니다',
    );
    await fireEvent.press(getByLabelText('스크린샷 추가'));
    await waitFor(() => expect(onPickImage).toHaveBeenCalledTimes(1));

    await fireEvent.press(getByText('제출하기'));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        title: '앱이 꺼져요',
        content: '방 화면에서 사진 저장을 누르면 꺼집니다',
        images: [{ uri: 'file://shot.png', name: 'shot.png', type: 'image/png' }],
      }),
    );
    // 성공 시 폼 초기화 + 접수 안내.
    expect(getByText(/제보가 접수됐어요/)).toBeTruthy();
    expect(getByPlaceholderText('어떤 문제가 있었나요?').props.value).toBe('');
  });

  it('explains an empty form instead of submitting', async () => {
    const onSubmit = jest.fn();
    const { getByText } = await render(
      <ToastProvider>
        <BugReportScreen onSubmit={onSubmit} />
      </ToastProvider>,
    );
    await fireEvent.press(getByText('제출하기'));
    expect(getByText('제목과 내용을 입력해주세요')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('removes an attached screenshot', async () => {
    const onPickImage = jest.fn(async () => ({
      uri: 'file://shot.png',
      name: 'shot.png',
      type: 'image/png',
    }));
    const { getByLabelText, queryByLabelText } = await render(
      <BugReportScreen onPickImage={onPickImage} />,
    );
    await fireEvent.press(getByLabelText('스크린샷 추가'));
    await waitFor(() => expect(getByLabelText('스크린샷 1 삭제')).toBeTruthy());
    await fireEvent.press(getByLabelText('스크린샷 1 삭제'));
    expect(queryByLabelText('스크린샷 1 삭제')).toBeNull();
  });

  /**
   * 제보 후 첨부를 다시 볼 방법이 없었다 (#736). 비공개 리소스라 주소만으로는
   * 못 그리고, 셸이 인증 헤더로 받아 data URI로 넘겨준다.
   */
  describe('첨부 스크린샷 (#736)', () => {
    const withShot = [
      {
        id: 1,
        title: '방이 안 열려요',
        status: 'RECEIVED' as const,
        date: '8월 20일',
        screenshotKeys: ['bug/a.png'],
      },
    ];

    it('불러온 첨부를 썸네일로 보여주고, 누르면 크게 띄운다', async () => {
      const onLoadScreenshot = jest.fn(async () => 'data:image/png;base64,AAA');
      const { getByTestId, getByLabelText, queryByLabelText } = await render(
        <BugReportScreen entries={withShot} onLoadScreenshot={onLoadScreenshot} />,
      );
      await waitFor(() => expect(getByTestId('bug-shot-bug/a.png')).toBeTruthy());
      expect(onLoadScreenshot).toHaveBeenCalledWith('bug/a.png');

      // 뷰어는 누르기 전엔 없다.
      expect(queryByLabelText('첨부 닫기')).toBeNull();
      await fireEvent.press(getByLabelText('첨부 스크린샷 크게 보기'));
      expect(getByLabelText('첨부 닫기')).toBeTruthy();
    });

    it('불러오기가 실패하면 썸네일을 안 그린다 — 제보 내역은 그대로 보인다', async () => {
      const { getByText, queryByLabelText } = await render(
        <BugReportScreen entries={withShot} onLoadScreenshot={jest.fn(async () => null)} />,
      );
      expect(getByText('방이 안 열려요')).toBeTruthy();
      await waitFor(() => expect(queryByLabelText('첨부 스크린샷 크게 보기')).toBeNull());
    });

    it('로더가 없으면 아예 시도하지 않는다 (데모·갤러리)', async () => {
      const { queryByLabelText } = await render(<BugReportScreen entries={withShot} />);
      expect(queryByLabelText('첨부 스크린샷 크게 보기')).toBeNull();
    });
  });
});
