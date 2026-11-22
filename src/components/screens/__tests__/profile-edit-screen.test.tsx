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
  it('selects only an unworn owned character without losing profile edits', async () => {
    const onSelectCharacter = jest.fn();
    const onSave = jest.fn();
    const characters = [
      { serverId: 1, id: 'cat' as const, name: '고양이', selected: true },
      { serverId: 99, id: 'fox' as const, name: '여우', selected: false },
    ];
    const screen = await render(
      <ProfileEditScreen
        initialNickname="루티"
        ownedCharacters={characters}
        onSelectCharacter={onSelectCharacter}
        onSave={onSave}
      />,
    );
    expect(screen.queryByText('캐릭터는 나의 방에서 바꿀 수 있어요.')).toBeNull();
    await fireEvent.changeText(screen.getByPlaceholderText('닉네임을 입력해주세요'), '새 이름');
    await fireEvent.press(screen.getByLabelText('캐릭터 변경'));
    await fireEvent.press(screen.getByLabelText('여우 착용'));
    expect(onSelectCharacter).toHaveBeenCalledWith(99);
    await fireEvent.press(screen.getByLabelText('캐릭터 변경'));
    await fireEvent.press(screen.getByLabelText('고양이 착용'));
    expect(onSelectCharacter).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByText('저장'));
    expect(onSave).toHaveBeenCalledWith('새 이름', '');
  });
  it('keeps nickname and bio when the full-screen character chooser is cancelled', async () => {
    const onSave = jest.fn();
    const onSelectCharacter = jest.fn();
    const screen = await render(
      <ProfileEditScreen
        initialNickname="루티"
        ownedCharacters={[{ serverId: 1, id: 'cat', name: '루양이', selected: true }]}
        onSelectCharacter={onSelectCharacter}
        onSave={onSave}
      />,
    );
    await fireEvent.changeText(screen.getByPlaceholderText('닉네임을 입력해주세요'), '새 이름');
    await fireEvent.changeText(
      screen.getByPlaceholderText('나를 한 줄로 소개해보세요'),
      '작성 중 소개',
    );
    await fireEvent.press(screen.getByLabelText('캐릭터 변경'));
    expect(screen.getByText('캐릭터 선택')).toBeTruthy();
    await fireEvent(screen.getByTestId('character-selection-modal'), 'requestClose');
    expect(screen.queryByLabelText('루양이 착용')).toBeNull();
    await fireEvent.press(screen.getByText('저장'));
    expect(onSelectCharacter).not.toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledWith('새 이름', '작성 중 소개');
  });
});
