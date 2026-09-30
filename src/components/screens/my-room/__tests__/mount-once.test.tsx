import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { MountOnce } from '@/components/screens/my-room/mount-once';

describe('MountOnce (성능 장부 R5)', () => {
  it('한 번도 안 열렸으면 그리지 않고, 열리면 그 렌더에 그리고, 닫혀도 남긴다', async () => {
    const ui = await render(
      <MountOnce when={false}>
        <Text>시트</Text>
      </MountOnce>,
    );
    expect(ui.queryByText('시트')).toBeNull();
    await ui.rerender(
      <MountOnce when>
        <Text>시트</Text>
      </MountOnce>,
    );
    expect(ui.getByText('시트')).toBeTruthy();
    await ui.rerender(
      <MountOnce when={false}>
        <Text>시트</Text>
      </MountOnce>,
    );
    // 닫힘 애니메이션을 돌릴 수 있게 남아 있다.
    expect(ui.getByText('시트')).toBeTruthy();
  });
});
