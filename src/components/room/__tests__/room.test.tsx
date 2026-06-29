import { render } from '@testing-library/react-native';

import { Room } from '@/components/room/room';

describe('Room', () => {
  it('renders default furniture and the character', async () => {
    const { getByLabelText, getByText } = await render(<Room />);
    expect(getByLabelText('포근한 침대')).toBeTruthy();
    expect(getByLabelText('햇살 창문')).toBeTruthy();
    expect(getByText('🐱')).toBeTruthy(); // default character (cat)
  });

  it('renders only the placed furniture and the chosen character', async () => {
    const { getByLabelText, queryByLabelText, getByText } = await render(
      <Room placedFurnitureIds={['hanok-bed']} characterId="tiger" />,
    );
    expect(getByLabelText('한옥 자개 침대')).toBeTruthy();
    expect(queryByLabelText('포근한 침대')).toBeNull();
    expect(getByText('🐯')).toBeTruthy();
  });
});
