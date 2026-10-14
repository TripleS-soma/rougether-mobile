import { fireEvent, render } from '@testing-library/react-native';

import { ProfileEditScreen } from '@/components/screens/profile-edit-screen';

describe('ProfileEditScreen', () => {
  it('renders the title', async () => {
    const { getByText } = await render(<ProfileEditScreen />);
    expect(getByText('프로필 편집')).toBeTruthy();
  });

  // 한 줄 소개는 같은 집 구성원에게 공개된다(2026-10-14) — 입력하는 사람이 알아야 한다.
  it('tells who can see the bio', async () => {
    const { getByText } = await render(<ProfileEditScreen />);
    expect(getByText('같은 집 친구가 내 방에 놀러 오면 이 소개가 보여요.')).toBeTruthy();
  });

  it('saves the trimmed nickname and bio', async () => {
    const onSave = jest.fn();
    const { getByText, getByPlaceholderText } = await render(<ProfileEditScreen onSave={onSave} />);

    await fireEvent.changeText(getByPlaceholderText('닉네임을 입력해주세요'), '  루티  ');
    await fireEvent.changeText(getByPlaceholderText('나를 한 줄로 소개해보세요'), '안녕하세요');
    await fireEvent.press(getByText('저장'));

    expect(onSave).toHaveBeenCalledWith('루티', '안녕하세요');
  });

  it('does not save with an empty nickname', async () => {
    const onSave = jest.fn();
    const { getByText, getByPlaceholderText } = await render(<ProfileEditScreen onSave={onSave} />);

    await fireEvent.changeText(getByPlaceholderText('닉네임을 입력해주세요'), '   ');
    await fireEvent.press(getByText('저장'));

    expect(onSave).not.toHaveBeenCalled();
  });
});
