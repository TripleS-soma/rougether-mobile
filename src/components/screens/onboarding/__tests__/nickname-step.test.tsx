import { fireEvent, render } from '@testing-library/react-native';
import { useState } from 'react';
import { Platform } from 'react-native';

import { NicknameStep } from '@/components/screens/onboarding/nickname-step';

/**
 * 닉네임 입력칸 커서 (2026-11-09) — 안드로이드는 가운데 정렬 입력칸에 네이티브 플레이스홀더가 있으면
 * 빈 칸 커서를 플레이스홀더 끝(오른쪽)에 그린다. 그래서 안드로이드만 플레이스홀더를 겹친 글자로 그린다.
 */
function Harness() {
  const [nickname, setNickname] = useState('');
  return (
    <NicknameStep
      screenStyle={undefined}
      androidKeyboard={0}
      characterId="cat"
      characterName="고양이"
      nickname={nickname}
      onChangeNickname={setNickname}
      onStart={jest.fn()}
      onPrevious={jest.fn()}
    />
  );
}

afterEach(() => jest.restoreAllMocks());

describe('NicknameStep 플레이스홀더', () => {
  it('안드로이드는 네이티브 플레이스홀더 대신 겹친 글자 — 입력하면 사라진다', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const ui = await render(<Harness />);
    const input = ui.getByLabelText('닉네임 입력');
    expect(input.props.placeholder).toBeUndefined();
    expect(ui.getByTestId('onboarding-nickname-placeholder')).toHaveTextContent(
      '닉네임 (12자까지)',
    );
    // 스크린리더에는 힌트로 같은 안내를 준다.
    expect(input.props.accessibilityHint).toBe('닉네임 (12자까지)');
    await fireEvent.changeText(input, '루게');
    expect(ui.queryByTestId('onboarding-nickname-placeholder')).toBeNull();
  });

  it('iOS는 네이티브 플레이스홀더를 그대로 쓴다', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const ui = await render(<Harness />);
    expect(ui.getByLabelText('닉네임 입력').props.placeholder).toBe('닉네임 (12자까지)');
    expect(ui.queryByTestId('onboarding-nickname-placeholder')).toBeNull();
  });
});
