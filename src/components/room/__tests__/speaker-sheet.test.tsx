import { fireEvent, render } from '@testing-library/react-native';
import { SpeakerSheet, type SpeakerSheetProps } from '@/components/room/speaker-sheet';
import { Room } from '@/components/room/room';
import { STARTER_SPEAKER_KEY } from '@/resources/speaker';
import type { FurnitureItem } from '@/resources/furniture';
const props: SpeakerSheetProps = {
  visible: true,
  onClose: jest.fn(),
  trackId: 'rain',
  volume: 0.35,
  playing: false,
  loading: false,
  error: null,
  onPlay: jest.fn(),
  onStop: jest.fn(),
  onSelectTrack: jest.fn(),
  onVolumeChange: jest.fn(),
};
it('재생·곡 선택·볼륨·닫기를 전달하고 로딩 중에도 취소할 수 있다', async () => {
  const view = await render(<SpeakerSheet {...props} />);
  expect(view.queryByText('나를 위한 작은 휴식')).toBeNull();
  expect(view.queryByText('방을 나가면 소리도 잠시 쉬어요.')).toBeNull();
  await fireEvent.press(view.getByText('재생'));
  expect(props.onPlay).toHaveBeenCalledTimes(1);
  await fireEvent.press(view.getByText('조용한 피아노'));
  expect(props.onSelectTrack).toHaveBeenCalledWith('piano');
  await fireEvent.press(view.getByLabelText('볼륨 높이기'));
  expect(props.onVolumeChange).toHaveBeenCalledWith(0.44999999999999996);
  await fireEvent.press(view.getByLabelText('스피커 닫기'));
  expect(props.onClose).toHaveBeenCalledTimes(1);
  await view.rerender(<SpeakerSheet {...props} loading />);
  await fireEvent.press(view.getByText('취소'));
  expect(props.onStop).toHaveBeenCalledTimes(1);
});
it('내 방에서만 스피커를 누를 수 있고 편집·방문 미리보기는 재생하지 않는다', async () => {
  const item: FurnitureItem = {
    id: 'speaker',
    name: '스피커',
    assetKey: STARTER_SPEAKER_KEY,
    category: '가구',
    price: 0,
    slot: 'bottomRight',
  };
  const scene = {
    furniture: [item],
    placements: [{ furnitureId: item.id, x: 0.76, y: 0.72, z: 0 }],
  };
  const open = jest.fn();
  const settings = jest.fn();
  const view = await render(
    <Room {...scene} onSpeakerPress={open} onSpeakerLongPress={settings} />,
  );
  await fireEvent.press(view.getByLabelText('스피커 재생'));
  expect(open).toHaveBeenCalledTimes(1);
  await fireEvent(view.getByLabelText('스피커 재생'), 'longPress');
  expect(settings).toHaveBeenCalledTimes(1);
  expect(open).toHaveBeenCalledTimes(1);
  await view.rerender(<Room {...scene} editable onSpeakerPress={open} />);
  expect(view.queryByLabelText('스피커 재생')).toBeNull();
  await view.rerender(<Room {...scene} />);
  expect(view.queryByLabelText('스피커 재생')).toBeNull();
});
