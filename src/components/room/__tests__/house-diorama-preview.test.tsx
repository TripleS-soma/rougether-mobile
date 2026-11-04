import { render } from '@testing-library/react-native';
import { HousePreviewFrame } from '@/components/room/house-preview-frame';
import { FOREST_CANOPY_COVER_KEY } from '@/resources/house-diorama';

it('summarizes the first four members and clearly accounts for the remaining annex members', async () => {
  const ui = await render(
    <HousePreviewFrame
      coverImageKey={FOREST_CANOPY_COVER_KEY}
      maxMembers={10}
      rooms={Array.from({ length: 10 }, () => ({ placements: [] }))}
    />,
  );
  expect(ui.getAllByTestId('preview-room')).toHaveLength(4);
  expect(ui.getByText('다른 별채에 6명')).toBeTruthy();
  expect(ui.queryByTestId('diorama-hero')).toBeNull();
});

it('does not invent occupants or furniture for an empty house', async () => {
  const ui = await render(
    <HousePreviewFrame coverImageKey={FOREST_CANOPY_COVER_KEY} memberCount={0} />,
  );
  expect(ui.queryByTestId('preview-room')).toBeNull();
  expect(ui.queryByTestId('diorama-character')).toBeNull();
});

it('uses full rooms for a classic house and updates when the same house changes mode', async () => {
  const props = {
    coverImageKey: FOREST_CANOPY_COVER_KEY,
    rooms: [{ placements: [] }, { placements: [] }],
  };
  const ui = await render(<HousePreviewFrame {...props} />);
  expect(ui.getAllByTestId('diorama-member')).toHaveLength(2);
  await ui.rerender(<HousePreviewFrame {...props} displayMode="CLASSIC" />);
  expect(ui.getByTestId('house-preview-frame')).toBeTruthy();
  expect(ui.getAllByTestId('preview-room')).toHaveLength(2);
  expect(ui.queryByTestId('diorama-member')).toBeNull();
});
