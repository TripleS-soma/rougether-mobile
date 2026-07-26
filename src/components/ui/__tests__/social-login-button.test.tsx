import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { SocialLoginButton } from '@/components/ui/social-login-button';

describe('SocialLoginButton', () => {
  it('labels each provider for screen readers', async () => {
    const { getByLabelText } = await render(
      <>
        <SocialLoginButton provider="kakao" />
        <SocialLoginButton provider="apple" />
        <SocialLoginButton provider="google" />
      </>,
    );

    expect(getByLabelText('카카오로 시작')).toBeTruthy();
    expect(getByLabelText('애플로 시작')).toBeTruthy();
    expect(getByLabelText('구글로 시작')).toBeTruthy();
  });

  it('fires onPress', async () => {
    const onPress = jest.fn();
    const { getByLabelText } = await render(
      <SocialLoginButton provider="kakao" onPress={onPress} />,
    );

    await fireEvent.press(getByLabelText('카카오로 시작'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('stays silent while disabled', async () => {
    const onPress = jest.fn();
    const { getByLabelText } = await render(
      <SocialLoginButton provider="google" onPress={onPress} disabled />,
    );

    await fireEvent.press(getByLabelText('구글로 시작'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('pins each container to the color its guideline mandates', async () => {
    const { getByTestId } = await render(
      <>
        <SocialLoginButton provider="kakao" />
        <SocialLoginButton provider="google" />
      </>,
    );

    // 카카오: 컨테이너 #FEE500 / Google: white + #747775 stroke. Both are vendor
    // rules, so they must NOT drift onto theme tokens.
    expect(StyleSheet.flatten(getByTestId('social-circle-kakao').props.style)).toMatchObject({
      backgroundColor: '#FEE500',
    });
    expect(StyleSheet.flatten(getByTestId('social-circle-google').props.style)).toMatchObject({
      backgroundColor: '#FFFFFF',
      borderColor: '#747775',
    });
  });
});
