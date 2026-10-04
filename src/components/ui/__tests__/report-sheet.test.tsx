import { fireEvent, render } from '@testing-library/react-native';

import { __resetSheetSerializer } from '@/components/ui/bottom-sheet';
import { REPORT_REASONS, ReportSheet } from '@/components/ui/report-sheet';
import { REPORT_DETAIL_MAX } from '@/constants/moderation';

afterEach(() => __resetSheetSerializer());

const renderSheet = (props: Partial<Parameters<typeof ReportSheet>[0]> = {}) =>
  render(
    <ReportSheet
      visible
      targetLabel="게시물"
      onSubmit={jest.fn()}
      onClose={jest.fn()}
      {...props}
    />,
  );

describe('ReportSheet (#1428)', () => {
  it('서버 enum 7종 사유를 한국어로 보여 준다', async () => {
    const { getByLabelText } = await renderSheet();
    expect(REPORT_REASONS).toEqual([
      'SPAM',
      'ABUSE',
      'SEXUAL',
      'VIOLENCE',
      'PERSONAL_INFO',
      'COPYRIGHT',
      'OTHER',
    ]);
    for (const label of [
      '스팸·광고',
      '욕설·괴롭힘',
      '음란물',
      '폭력·위험',
      '개인정보 노출',
      '저작권 침해',
      '기타',
    ]) {
      expect(getByLabelText(label)).toBeTruthy();
    }
  });

  it('사유를 고르기 전에는 신고하기가 잠겨 있다', async () => {
    const onSubmit = jest.fn();
    const { getByLabelText } = await renderSheet({ onSubmit });
    const submit = getByLabelText('신고하기');
    expect(submit.props.accessibilityState?.disabled).toBe(true);
    await fireEvent.press(submit);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('고른 사유와 앞뒤 공백을 뗀 설명으로 보낸다', async () => {
    const onSubmit = jest.fn();
    const { getByLabelText } = await renderSheet({ onSubmit });
    await fireEvent.press(getByLabelText('욕설·괴롭힘'));
    expect(getByLabelText('욕설·괴롭힘').props.accessibilityState?.checked).toBe(true);
    await fireEvent.changeText(getByLabelText('신고 내용 설명'), '  욕설이 있어요  ');
    await fireEvent.press(getByLabelText('신고하기'));
    expect(onSubmit).toHaveBeenCalledWith('ABUSE', '욕설이 있어요');
  });

  it('설명이 비어 있으면 undefined로', async () => {
    const onSubmit = jest.fn();
    const { getByLabelText } = await renderSheet({ onSubmit });
    await fireEvent.press(getByLabelText('기타'));
    await fireEvent.changeText(getByLabelText('신고 내용 설명'), '   ');
    await fireEvent.press(getByLabelText('신고하기'));
    expect(onSubmit).toHaveBeenCalledWith('OTHER', undefined);
  });

  it('설명은 500자에서 자른다', async () => {
    const { getByLabelText, getByText } = await renderSheet();
    await fireEvent.changeText(
      getByLabelText('신고 내용 설명'),
      'a'.repeat(REPORT_DETAIL_MAX + 20),
    );
    expect(getByLabelText('신고 내용 설명').props.value).toHaveLength(REPORT_DETAIL_MAX);
    expect(getByText(`${REPORT_DETAIL_MAX}/${REPORT_DETAIL_MAX}`)).toBeTruthy();
  });

  it('보내는 중에는 버튼이 잠기고 문구가 바뀐다', async () => {
    const onSubmit = jest.fn();
    const { getByLabelText, getByText } = await renderSheet({ onSubmit, submitting: true });
    expect(getByText('보내는 중…')).toBeTruthy();
    await fireEvent.press(getByLabelText('스팸·광고'));
    await fireEvent.press(getByLabelText('신고하기'));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
