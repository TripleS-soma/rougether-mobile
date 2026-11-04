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
