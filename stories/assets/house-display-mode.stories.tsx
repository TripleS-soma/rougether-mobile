import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { expect, userEvent, within } from 'storybook/test';
import { HouseScreen } from '@/components/screens/house-screen';
import { HouseMembersScreen } from '@/components/screens/house-members-screen';
import { manageableMembers } from '@/components/screens/house/members';
import type { MemberRoomPreview } from '@/components/room/room';
import type { House } from '@/components/screens/house/types';
import { Spacing } from '@/constants/theme';
import fixture from '@/dev/fixtures/house-diorama.json';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { HOUSE_DIORAMA_THEMES } from '@/resources/house-diorama';
import type { HouseDisplayMode } from '@/resources/house-display-mode';
import type { FurnitureItem } from '@/resources/furniture';

const furniture = fixture.furniture as FurnitureItem[];
const sampleRooms = fixture.rooms as MemberRoomPreview[];
const makeHouse = (
  members: number,
  coverImageKey: string,
  displayMode: HouseDisplayMode,
): House => ({
  houseId: 1,
  name: '우리 집',
  myRole: 'OWNER',
  maxMembers: members,
  memberCount: members,
  coverImageKey,
  displayMode,
  floors: Array.from({ length: Math.ceil(members / 2) }, (_, row) => ({
    level: `${row + 1}층`,
    rooms: Array.from({ length: Math.min(2, members - row * 2) }, (_, col) => ({
      name: `친구 ${row * 2 + col + 1}`,
      color: 'transparent',
      membershipId: row * 2 + col + 1,
    })),
  })).reverse(),
});
type Props = { members: number; furnished: boolean; themeId: string };
function Comparison({ members, furnished, themeId }: Props) {
  const t = useTokens();
  const Typography = useTypography();
  const cover = HOUSE_DIORAMA_THEMES.find((theme) => theme.id === themeId)!.coverImageKey;
  const rooms = Object.fromEntries(
    Array.from({ length: members }, (_, i) => [
      i + 1,
      {
        ...sampleRooms[i % sampleRooms.length],
        placements: furnished ? sampleRooms[i % sampleRooms.length].placements : [],
      },
    ]),
  );
  return (
    <View style={styles.comparison}>
      {(['DIORAMA', 'CLASSIC'] as const).map((mode) => (
        <View key={mode} style={styles.panel}>
          <Text style={[Typography.h3, { color: t.text }]}>
            {mode === 'DIORAMA' ? '그림 같은 집 (기본)' : '내 방 그대로'}
          </Text>
          <View style={styles.screen}>
            <HouseScreen
              houses={[makeHouse(members, cover, mode)]}
              roomPreviews={rooms}
              furniture={furniture}
            />
          </View>
        </View>
      ))}
    </View>
  );
}
function OwnerSettings() {
  const [house, setHouse] = useState(() =>
    makeHouse(4, HOUSE_DIORAMA_THEMES[0].coverImageKey, 'DIORAMA'),
  );
  return (
    <View style={styles.owner}>
      <HouseMembersScreen
        house={house}
        members={manageableMembers(house)}
        isOwner
        isKicked={() => false}
        memberCharacterId={() => 'cat'}
        onBack={() => {}}
        onLocalKick={() => {}}
        onLeaveDone={() => {}}
        onUpdateHouse={(_, input) => setHouse((value) => ({ ...value, ...input }))}
      />
    </View>
  );
}
const meta = {
  title: '에셋/공동집 보기 방식',
  id: 'assets-house-display-mode',
  component: Comparison,
  args: { members: 4, furnished: true, themeId: 'cloud-balloon' },
  argTypes: {
    members: { control: { type: 'range', min: 1, max: 10, step: 1 } },
    furnished: { control: 'boolean' },
    themeId: { control: 'select', options: HOUSE_DIORAMA_THEMES.map((theme) => theme.id) },
  },
  parameters: { canvasWidth: 860 },
} satisfies Meta<typeof Comparison>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Compare: Story = { name: '두 모드 비교' };
export const EmptyFurniture: Story = { name: '가구 없는 방', args: { furnished: false } };
export const TenMembers: Story = { name: '10명과 방 방문', args: { members: 10 } };
export const OwnerChoice: Story = {
  name: '방장 설정과 다시 열기',
  render: () => <OwnerSettings />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: '집 정보 수정' }));
    await userEvent.click(canvas.getByRole('radio', { name: /내 방 그대로/ }));
    await userEvent.click(canvas.getByRole('button', { name: '집 정보 저장' }));
    await userEvent.click(canvas.getByRole('button', { name: '집 정보 수정' }));
    await expect(canvas.getByRole('radio', { name: /내 방 그대로/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  },
};
const styles = StyleSheet.create({
  comparison: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.four },
  panel: { width: 390, gap: Spacing.two },
  screen: { height: 760 },
  owner: { height: 850, width: 390 },
});
