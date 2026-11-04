import { render, screen } from '@testing-library/react-native';
import { HouseDioramaMember } from '@/components/room/house-diorama-member';
import type { FurnitureItem } from '@/resources/furniture';
const furniture: FurnitureItem[] = [
  {
    id: 'bed',
    name: '침대',
    assetKey: 'items/test/furniture/bed.png',
    category: '가구',
    price: 0,
    slot: 'bottomLeft',
  },
];
describe('HouseDioramaMember', () => {
  it('renders the character without adding sample furniture for an empty room', async () => {
    await render(
      <HouseDioramaMember
        side={0}
        characterId="cat"
        furniture={furniture}
        preview={{ placements: [] }}
      />,
    );
    expect(screen.getByTestId('diorama-character')).toBeTruthy();
    expect(screen.queryByTestId('diorama-hero')).toBeNull();
  });
  it('renders the selected real placement in a separate contain box', async () => {
    await render(
      <HouseDioramaMember
        side={1}
        characterId="dog"
        furniture={furniture}
        preview={{ placements: [{ furnitureId: 'bed', x: 0.5, y: 0.5, z: 0 }] }}
      />,
    );
    expect(screen.getByTestId('diorama-hero')).toBeTruthy();
    expect(screen.queryByTestId('diorama-secondary')).toBeNull();
  });
});
