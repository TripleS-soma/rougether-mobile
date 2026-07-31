import { fireEvent, render } from '@testing-library/react-native';
import { act } from 'react';

import { PolicyViewerScreen } from '@/components/screens/policy-viewer-screen';

// The native WebView never renders under jest — stand in with a plain View so
// the screen's load/error wiring can be driven through props.
jest.mock('react-native-webview', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return { WebView: (props: object) => React.createElement(View, props) };
});

const URL = 'https://triples-soma.github.io/policy/terms.html';

describe('PolicyViewerScreen (#652)', () => {
  it('renders the title, back button, and the document WebView', async () => {
    const onBack = jest.fn();
    const { getByText, getByLabelText, getByTestId } = await render(
      <PolicyViewerScreen title="이용약관" url={URL} onBack={onBack} />,
    );
    expect(getByText('이용약관')).toBeTruthy();
    expect(getByTestId('policy-webview').props.source).toEqual({ uri: URL });
    await fireEvent.press(getByLabelText('뒤로 가기'));
    expect(onBack).toHaveBeenCalled();
  });

  it('shows a retry state on load failure and remounts the WebView on retry', async () => {
    const { getByText, getByTestId, queryByTestId } = await render(
      <PolicyViewerScreen title="개인정보처리방침" url={URL} />,
    );
    await act(async () => {
      getByTestId('policy-webview').props.onError();
    });
    expect(getByText('문서를 불러오지 못했어요.')).toBeTruthy();
    expect(queryByTestId('policy-webview')).toBeNull();

    await fireEvent.press(getByText('다시 시도'));
    expect(getByTestId('policy-webview')).toBeTruthy();
  });
});
