import { fireEvent, render } from '@testing-library/react-native';

import { ListRow } from '@/components/ui/list-row';

// 설정·마이페이지 공용 목록 행 (#1088 리뷰 반영).
describe('ListRow', () => {
  it('라벨을 그리고 누르면 onPress', async () => {
    const onPress = jest.fn();
    const { getByText } = await render(<ListRow icon="help" label="도움말" onPress={onPress} />);
    await fireEvent.press(getByText('도움말'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('마지막 행(last)은 하단 구분선을 긋지 않는다', async () => {
    const flatten = (node: { props: Record<string, unknown> }) =>
      Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean)) as Record<
        string,
        unknown
      >;
    const mid = await render(<ListRow icon="help" label="중간" />);
    expect(flatten(mid.getByRole('button')).borderBottomWidth).toBeGreaterThan(0);
    const last = await render(<ListRow icon="help" label="마지막" last />);
    expect(flatten(last.getByRole('button')).borderBottomWidth).toBeUndefined();
  });
});
