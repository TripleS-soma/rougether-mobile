import { render, within } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import type { TestInstance } from 'test-renderer';

import { MinigameLayout } from '@/components/screens/minigame-layout';
import { MinigameLeaderboardScreen } from '@/components/screens/minigame-leaderboard-screen';
import { MinigameRunnerScreen } from '@/components/screens/minigame-runner-screen';
import { MinigamesScreen } from '@/components/screens/minigames-screen';
import { ContentMaxWidth } from '@/constants/theme';
import { flattenStyle } from '@/test-utils/style';

function expectConstrainedScroll(container: TestInstance) {
  // Inspect the rendered native ScrollView, not a mocked layout or hook result.
  const scrollViews = container.queryAll((node) => node.type === 'RCTScrollView');
  expect(scrollViews).toHaveLength(1);
  const scroll = scrollViews[0];
  expect(flattenStyle(scroll.props.contentContainerStyle)).toMatchObject({
    width: '100%',
    maxWidth: ContentMaxWidth,
    alignSelf: 'center',
  });
  return scroll;
}

it('keeps the real scroll content centered and width-limited when its parent grows to a tablet', async () => {
  const layout = (width: number) => (
    <View style={{ width, height: 768 }}>
      <MinigameLayout title="미니게임">
        <Text>게임 콘텐츠</Text>
      </MinigameLayout>
    </View>
  );
  const ui = await render(layout(390));
  expect(within(expectConstrainedScroll(ui.container)).getByText('게임 콘텐츠')).toBeTruthy();

  await ui.rerender(layout(1024));
  const scroll = expectConstrainedScroll(ui.container);
  expect(ContentMaxWidth).toBeLessThan(1024);
  expect(within(scroll).getByText('게임 콘텐츠')).toBeTruthy();
});

it.each([
  {
    screen: 'hub',
    element: <MinigamesScreen />,
    content: '지금은 등록된 게임이 없어요.',
  },
  {
    screen: 'runner',
    element: <MinigameRunnerScreen game={<Text>플레이 중인 게임</Text>} />,
    content: '플레이 중인 게임',
  },
  {
    screen: 'leaderboard',
    element: <MinigameLeaderboardScreen />,
    content: '루틴 러너',
  },
])(
  'keeps $screen content inside the shared width-limited scroll on a tablet',
  async ({ element, content }) => {
    const ui = await render(<View style={{ width: 1024, height: 768 }}>{element}</View>);
    const scroll = expectConstrainedScroll(ui.container);
    expect(within(scroll).getByText(content)).toBeTruthy();
  },
);
