import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ChatPhotoViewer } from '@/components/chat/chat-photo-viewer';
import { MediaViewer } from '@/constants/theme';

const base = {
  visible: true,
  uri: 'data:image/jpeg;base64,test',
  senderName: '김다현',
  sentLabel: '11월 11일 수요일 오후 8:30',
  onClose: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

// 2026-11-11 제보: 테마 바탕(크림) 위에 사진이 작게 떠 있고 "닫기" 글자만 있어 화면이 붕 떠 보였다.
describe('ChatPhotoViewer', () => {
  it('검정 바탕에 보낸 사람과 보낸 시각을 띄우고, 왼쪽 위 뒤로가기로 닫는다', async () => {
    const ui = await render(<ChatPhotoViewer {...base} />);
    expect(ui.getByTestId('chat-photo-sender')).toHaveTextContent('김다현');
    expect(ui.getByTestId('chat-photo-sent')).toHaveTextContent('11월 11일 수요일 오후 8:30');
    const root = ui.getByTestId('chat-photo-viewer');
    expect(StyleSheet.flatten(root.props.style).backgroundColor).toBe(MediaViewer.backdrop);

    await fireEvent.press(ui.getByLabelText('닫기'));
    expect(base.onClose).toHaveBeenCalledTimes(1);
  });

  it('사진이 없거나 닫혀 있으면 아무것도 그리지 않는다', async () => {
    const ui = await render(<ChatPhotoViewer {...base} uri={null} />);
    expect(ui.queryByTestId('chat-photo-viewer')).toBeNull();
    await ui.rerender(<ChatPhotoViewer {...base} visible={false} />);
    expect(ui.queryByTestId('chat-photo-viewer')).toBeNull();
  });

  it('[피드에 올리기]는 넘겨받았을 때만 그리고, 누르면 부른다', async () => {
    const onShareToFeed = jest.fn();
    const ui = await render(<ChatPhotoViewer {...base} />);
    expect(ui.queryByLabelText('피드에 올리기')).toBeNull();

    await ui.rerender(<ChatPhotoViewer {...base} onShareToFeed={onShareToFeed} />);
    await fireEvent.press(ui.getByLabelText('피드에 올리기'));
    expect(onShareToFeed).toHaveBeenCalledTimes(1);
  });
});
