import { fireEvent, render } from '@testing-library/react-native';
import { BandInstrumentsPreview } from '../band-instruments-preview';
import { Room } from '@/components/room/room';
import { createInstrumentPlayer } from '@/lib/instrument-player';
import { INSTRUMENT_SOUNDS } from '@/resources/instrument-sounds';
import type { FurnitureItem } from '@/resources/furniture';

jest.mock('@/lib/instrument-player', () => ({ createInstrumentPlayer: jest.fn() }));
const factory = jest.mocked(createInstrumentPlayer);
beforeEach(() =>
  factory.mockImplementation(() => ({
    replay: jest.fn().mockResolvedValue(undefined),
    dispose: jest.fn(),
  })),
);

it('실제 방의 네 악기는 각각 재생되며 음소거·꾸미기 모드는 재생을 막는다', async () => {
  const ui = await render(<BandInstrumentsPreview />);
  const buttons = ui.getAllByRole('button', { name: /연주$/ });
  expect(buttons).toHaveLength(4);
  for (const button of buttons) await fireEvent.press(button);
  expect(factory).toHaveBeenCalledTimes(4);
  for (const result of factory.mock.results) expect(result.value.replay).toHaveBeenCalledTimes(1);
  await fireEvent.press(ui.getByRole('switch', { name: '악기 효과음' }));
  for (const result of factory.mock.results) expect(result.value.dispose).toHaveBeenCalledTimes(1);
  await fireEvent.press(buttons[0]);
  expect(factory).toHaveBeenCalledTimes(4);
  await fireEvent.press(ui.getByRole('switch', { name: '악기 효과음' }));
  await fireEvent.press(ui.getByRole('switch', { name: '꾸미기 모드' }));
  expect(ui.queryAllByRole('button', { name: /연주$/ })).toHaveLength(0);
  await fireEvent.press(ui.getByRole('switch', { name: '꾸미기 모드' }));
  await fireEvent.press(ui.getAllByRole('button', { name: /연주$/ })[0]);
  expect(factory).toHaveBeenCalledTimes(5);
});

it('작은 방·읽기 전용 방·일반 가구는 연주 버튼을 만들지 않는다', async () => {
  const furniture: FurnitureItem[] = [
    {
      id: 'guitar',
      name: '기타',
      slot: 'bottomLeft',
      category: '가구',
      price: 10,
      assetKey: INSTRUMENT_SOUNDS[0].assetKey,
    },
    {
      id: 'plant',
      name: '화분',
      slot: 'bottomLeft',
      category: '가구',
      price: 10,
      assetKey: 'items/plants/plant.png',
    },
  ];
  const placements = furniture.map((item, index) => ({
    furnitureId: item.id,
    x: 0.3 + index * 0.4,
    y: 0.6,
    z: index,
  }));
  const press = jest.fn();
  const ui = await render(
    <Room
      furniture={furniture}
      placements={placements}
      characterId={null}
      onInstrumentPress={press}
    />,
  );
  await fireEvent.press(ui.getByRole('button', { name: '기타 연주' }));
  expect(press).toHaveBeenCalledWith(INSTRUMENT_SOUNDS[0].assetKey);
  expect(ui.queryByRole('button', { name: '화분 연주' })).toBeNull();
  await ui.rerender(
    <Room
      furniture={furniture}
      placements={placements}
      characterId={null}
      onInstrumentPress={press}
      fill
    />,
  );
  expect(ui.queryAllByRole('button')).toHaveLength(0);
  await ui.rerender(<Room furniture={furniture} placements={placements} characterId={null} />);
  expect(ui.queryAllByRole('button')).toHaveLength(0);
});
