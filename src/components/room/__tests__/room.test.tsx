import { fireEvent, render } from '@testing-library/react-native';

import { Room } from '@/components/room/room';

describe('Room', () => {
  it('renders default furniture and the character', async () => {
    const { getByLabelText } = await render(<Room />);
    expect(getByLabelText('포근한 침대')).toBeTruthy();
    expect(getByLabelText('햇살 창문')).toBeTruthy();
    expect(getByLabelText('고양이')).toBeTruthy(); // default character (cat), pose 0
  });

  it('renders only the placed furniture and the chosen character', async () => {
    const { getByLabelText, queryByLabelText } = await render(
      <Room placedFurnitureIds={['hanok-bed']} characterId="tiger" />,
    );
    expect(getByLabelText('한옥 자개 침대')).toBeTruthy();
    expect(queryByLabelText('포근한 침대')).toBeNull();
    expect(getByLabelText('호랑이')).toBeTruthy();
  });

  it('exposes a tappable character that cycles poses when interactive', async () => {
    const { getByLabelText } = await render(<Room interactiveCharacter />);
    const character = getByLabelText('고양이, 눌러서 포즈 바꾸기');
    expect(character).toBeTruthy();
    // Tapping cycles the pose without unmounting the character.
    fireEvent.press(character);
    expect(getByLabelText('고양이, 눌러서 포즈 바꾸기')).toBeTruthy();
  });
});
