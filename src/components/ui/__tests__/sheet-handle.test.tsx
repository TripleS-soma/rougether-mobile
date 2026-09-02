import { render } from '@testing-library/react-native';

import { SheetHandle } from '@/components/ui/sheet-handle';

describe('SheetHandle (#1015)', () => {
  it('그래버를 그리되 접근성 트리에는 올리지 않는다 — 장식 요소', async () => {
    const { getByTestId } = await render(<SheetHandle />);
    const handle = getByTestId('sheet-handle');
    expect(handle.props.importantForAccessibility).toBe('no');
  });
});
