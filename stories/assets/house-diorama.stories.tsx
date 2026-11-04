import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { expect, waitFor, within } from 'storybook/test';

import { HouseDioramaPreview } from '@/components/room/house-diorama-preview';
import type { MemberRoomPreview } from '@/components/room/room';
import { Radius, Spacing } from '@/constants/theme';
import fixture from '@/dev/fixtures/house-diorama.json';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { HOUSE_DIORAMA_ASPECT, HOUSE_DIORAMA_THEMES } from '@/resources/house-diorama';
import type { FurnitureItem } from '@/resources/furniture';

const NAMES: Record<string, string> = {
  'cloud-balloon': '구름 풍선집',
  'coral-aquarium': '산호 수족관 집',
  'mushroom-forest': '버섯 숲집',
  'night-observatory': '밤의 천문대 집',
  'forest-canopy': '초록 나무집',
  'evening-brick': '저녁빛 벽돌집',
};
const furniture = fixture.furniture as FurnitureItem[];
const sampleRooms = fixture.rooms as MemberRoomPreview[];

type Props = { themeId: string; members: number; furnished: boolean };

function Downloads({ themeId }: { themeId: string }) {
  const t = useTokens();
  const Typography = useTypography();
  const name = NAMES[themeId];
  const style = {
    color: t.primary,
    fontFamily: Typography.body.fontFamily,
    fontSize: Typography.body.fontSize,
  };
  return (
    <View style={styles.links}>
      <a href={`house-assets/source/${themeId}.png`} download={`${themeId}.png`} style={style}>
        {name} 원본 PNG 다운로드
      </a>
      <a href={`house-assets/app/${themeId}.webp`} download={`${themeId}.webp`} style={style}>
        {name} 앱 WebP 다운로드
      </a>
    </View>
  );
}

function HouseAsset({ themeId, members, furnished }: Props) {
  const t = useTokens();
  const Typography = useTypography();
  const theme = HOUSE_DIORAMA_THEMES.find((theme) => theme.id === themeId)!;
  const count = Math.max(0, Math.min(10, members));
  const rooms = Array.from({ length: count }, (_, index) => ({
    ...sampleRooms[index % sampleRooms.length],
    placements: furnished ? sampleRooms[index % sampleRooms.length].placements : [],
  }));
  return (
    <View style={styles.asset}>
      <Text style={[Typography.h3, { color: t.text }]}>{NAMES[themeId]}</Text>
      <HouseDioramaPreview
        theme={theme}
        rooms={rooms}
        furniture={furniture}
        maxMembers={count}
        name={NAMES[themeId]}
      />
      <Text selectable style={[Typography.supporting, { color: t.textMuted }]}>
        PNG 1024 × 1536 / WebP 768 × 1152 / 2:3
      </Text>
      <Downloads themeId={themeId} />
    </View>
  );
}

function Catalog() {
  const t = useTokens();
  const Typography = useTypography();
  return (
    <View style={styles.catalog}>
      <Text style={[Typography.h2, { color: t.text }]}>마케팅용 공동집 에셋 6종</Text>
      <Text style={[Typography.body, { color: t.textMuted }]}>
        가구와 캐릭터가 없는 원본입니다. PNG는 배경 포함 1024 × 1536이며 투명 배경이 아닙니다. 아래
        링크로 원본과 실제 앱 WebP를 각각 저장하세요. 출시 전 디자인입니다.
      </Text>
      <View style={styles.grid}>
        {HOUSE_DIORAMA_THEMES.map((theme) => (
          <View key={theme.id} style={[styles.card, { borderColor: t.border }]}>
            <Image
              source={theme.source}
              style={styles.art}
              contentFit="contain"
              accessibilityLabel={`${NAMES[theme.id]} 가구 없는 배경`}
            />
            <Text style={[Typography.h3, { color: t.text }]}>{NAMES[theme.id]}</Text>
            <Downloads themeId={theme.id} />
          </View>
        ))}
      </View>
    </View>
  );
}

const meta = {
  id: 'assets-house-diorama',
  title: '에셋/공동집',
  component: HouseAsset,
  tags: ['autodocs'],
  args: { themeId: 'forest-canopy', members: 4, furnished: true },
  argTypes: {
    themeId: { control: 'select', options: Object.keys(NAMES), description: '집 디자인 6종' },
    members: {
      control: { type: 'range', min: 0, max: 10, step: 1 },
      description: '미리보기 인원. 4명 초과는 별채 인원으로 표시합니다.',
    },
    furnished: { control: 'boolean', description: '실제 배치 가구의 샘플 표시' },
  },
  parameters: {
    docs: {
      description: {
        component:
          '앱과 같은 HouseDioramaPreview를 사용합니다. 멤버와 배치는 샘플이고 가구는 실제 CDN 에셋입니다. 다운로드 PNG와 WebP에는 가구나 캐릭터가 포함되지 않습니다. 신규 PNG 6개는 Storybook 정적 파일로만 제공하며 모바일 번들에는 추가하지 않습니다.',
      },
    },
  },
} satisfies Meta<typeof HouseAsset>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CatalogDownloads: Story = {
  name: '6종 원본과 다운로드',
  render: () => <Catalog />,
  parameters: { canvasWidth: 1200, controls: { disable: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getAllByRole('img')).toHaveLength(6));
    for (const [id, name] of Object.entries(NAMES)) {
      await expect(canvas.getByRole('link', { name: `${name} 원본 PNG 다운로드` })).toHaveAttribute(
        'href',
        `house-assets/source/${id}.png`,
      );
      await expect(canvas.getByRole('link', { name: `${name} 앱 WebP 다운로드` })).toHaveAttribute(
        'href',
        `house-assets/app/${id}.webp`,
      );
    }
  },
};
export const Playground: Story = { name: '인원과 가구 조절하기' };
export const Empty: Story = {
  name: '가구와 인물 없는 빈집',
  args: { members: 0, furnished: false },
};
export const SingleMember: Story = { name: '1명', args: { members: 1 } };
export const TenMembers: Story = { name: '10명과 별채 표시', args: { members: 10 } };
export const ForestCanopy: Story = { name: '초록 나무집', args: { themeId: 'forest-canopy' } };
export const EveningBrick: Story = { name: '저녁빛 벽돌집', args: { themeId: 'evening-brick' } };

const styles = StyleSheet.create({
  catalog: { gap: Spacing.four },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.four },
  card: {
    minWidth: 240,
    flexBasis: '30%',
    flexGrow: 1,
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.three,
  },
  asset: { gap: Spacing.three },
  art: { width: '100%', aspectRatio: HOUSE_DIORAMA_ASPECT },
  links: { gap: Spacing.two },
});
