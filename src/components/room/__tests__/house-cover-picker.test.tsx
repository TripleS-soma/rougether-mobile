import { fireEvent, render } from '@testing-library/react-native';

import { type HouseCover, HouseCoverPicker } from '@/components/room/house-cover-picker';
import { FRAME_ASPECT } from '@/components/room/house-preview-frame';
import { i18n } from '@/i18n';

const COVERS: HouseCover[] = [
  {
    code: 'cloud_balloon',
    name: '구름 풍선 집',
    coverImageKey: 'house/cloud-balloon/frame.png',
  },
  {
    code: 'coral_aquarium',
    name: '산호 수족관 집',
    coverImageKey: 'house/coral-aquarium/frame.png',
  },
];

describe('HouseCoverPicker', () => {
  afterEach(async () => {
    await i18n.changeLanguage('ko');
  });

  it('영어에서는 커버 키 슬러그로 영어 이름을, 모르는 슬러그는 서버 이름을 쓴다 (#893)', async () => {
    await i18n.changeLanguage('en');
    const covers: HouseCover[] = [
      ...COVERS,
      { code: 'new', name: '새 집', coverImageKey: 'house/brand-new/frame.png' },
    ];
    const { getByText, getByLabelText } = await render(
      <HouseCoverPicker covers={covers} onSelect={jest.fn()} />,
    );
    expect(getByText('Cloud Balloon House')).toBeTruthy();
    expect(getByLabelText('Coral Aquarium House cover')).toBeTruthy();
    expect(getByText('새 집')).toBeTruthy();
  });

  it('긴 이름이 잘리지 않게 두 줄까지 허용한다 (#1112)', async () => {
    const covers: HouseCover[] = [
      { code: 'obs', name: '밤의 천문대 집', coverImageKey: 'house/obs/frame.png' },
    ];
    const { getByTestId } = await render(
      <HouseCoverPicker covers={covers} selectedKey={undefined} onSelect={() => {}} />,
    );
    expect(getByTestId('cover-label').props.numberOfLines).toBe(2);
  });

  it('renders a CDN thumbnail per cover and reports the tapped key', async () => {
    const onSelect = jest.fn();
    const { getByLabelText, queryAllByTestId } = await render(
      <HouseCoverPicker covers={COVERS} onSelect={onSelect} />,
    );

    expect(queryAllByTestId('cover-art')).toHaveLength(2);
    await fireEvent.press(getByLabelText('산호 수족관 집 커버'));
    expect(onSelect).toHaveBeenCalledWith('house/coral-aquarium/frame.png');
  });

  it('썸네일은 프레임 전체가 보이게 contain + 프레임 비율로 렌더한다 (#723)', async () => {
    const { getAllByTestId } = await render(
      <HouseCoverPicker covers={COVERS} onSelect={jest.fn()} />,
    );
    const art = getAllByTestId('cover-art')[0];
    // cover였을 때 지붕·받침이 잘리던 것을 contain으로 전체 노출.
    expect(art.props.contentFit).toBe('contain');
    const flat = art.props.style.flat ? art.props.style.flat() : [].concat(art.props.style);
    const aspect = flat.find((s: { aspectRatio?: number }) => s && s.aspectRatio != null)?.aspectRatio; // prettier-ignore
    expect(aspect).toBeCloseTo(FRAME_ASPECT, 5);
  });

  it('marks the selected cover and renders nothing while the catalog is empty', async () => {
    const selected = await render(
      <HouseCoverPicker
        covers={COVERS}
        selectedKey="house/cloud-balloon/frame.png"
        onSelect={jest.fn()}
      />,
    );
    expect(selected.getByLabelText('구름 풍선 집 커버').props.accessibilityState.selected).toBe(
      true,
    );

    const empty = await render(<HouseCoverPicker covers={[]} onSelect={jest.fn()} />);
    expect(empty.queryAllByTestId('cover-art')).toHaveLength(0);
  });
});
