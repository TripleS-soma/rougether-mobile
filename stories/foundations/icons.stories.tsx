import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

const ICON_LABELS = {
  back: '뒤로',
  forward: '앞으로',
  close: '닫기',
  edit: '수정',
  menu: '메뉴',
  list: '목록',
  folder: '폴더',
  add: '추가',
  search: '검색',
  members: '멤버',
  kebab: '더보기',
  gift: '선물',
  sparkles: '반짝임',
  ticket: '티켓',
  trash: '삭제',
  check: '확인',
  copy: '복사',
  'checkbox-off': '미선택',
  bell: '알림',
  'bell-off': '알림 끄기',
  camera: '카메라',
  calendar: '달력',
  leaf: '잎사귀',
  flame: '불꽃',
  star: '별',
  leave: '나가기',
  heart: '하트',
  flip: '뒤집기',
  'rotate-ccw': '왼쪽 회전',
  'rotate-cw': '오른쪽 회전',
  'layer-up': '앞으로 이동',
  'layer-down': '뒤로 이동',
  coin: '코인',
  diamond: '다이아몬드',
  shop: '상점',
  profile: '프로필',
  lock: '잠금',
  sound: '소리',
  help: '도움말',
  bug: '오류 제보',
  palette: '테마',
  moon: '다크 모드',
  refresh: '새로고침',
  myRoom: '나의 방',
  house: '공동집',
  settings: '설정',
} satisfies Record<IconName, string>;

function IconCatalog() {
  const t = useTokens();
  const Typography = useTypography();
  return (
    <View style={styles.grid}>
      {(Object.entries(ICON_LABELS) as [IconName, string][]).map(([name, label]) => (
        <View
          key={name}
          style={[styles.item, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Icon name={name} size={Spacing.five} />
          <Text style={[Typography.label, { color: t.text }]}>{label}</Text>
          <Text selectable style={[Typography.supporting, { color: t.textMuted }]}>
            {name}
          </Text>
        </View>
      ))}
    </View>
  );
}

const meta = {
  id: 'foundations-icons',
  title: '디자인 토큰/아이콘',
  component: Icon,
  tags: ['autodocs'],
  args: { name: 'leaf', size: 32 },
  argTypes: {
    name: {
      control: 'select',
      options: Object.keys(ICON_LABELS),
      description: '앱의 의미 기반 아이콘 이름',
    },
    size: { control: { type: 'range', min: 12, max: 64, step: 2 }, description: '아이콘 크기' },
    color: { control: 'color', description: '생략하면 현재 테마의 아이콘 색상 사용' },
  },
  parameters: {
    docs: {
      description: {
        component:
          '앱에서 사용하는 실제 Icon 컴포넌트입니다. 코인은 커스텀 발바닥 CoinIcon, 나머지는 Ionicons를 사용합니다. 이름·크기·색을 Controls에서 바꿀 수 있습니다.',
      },
    },
  },
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = { name: '아이콘 조절하기' };
export const Catalog: Story = {
  name: '전체 아이콘',
  render: () => <IconCatalog />,
  parameters: {
    canvasWidth: 900,
    controls: { disable: true },
    docs: {
      description: {
        story: 'IconName 전체 목록입니다. 모든 아이콘은 기본 테마 색상과 32px 크기로 표시됩니다.',
      },
    },
  },
};

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  item: {
    flexBasis: '22%',
    flexGrow: 1,
    minWidth: Spacing.six * 2,
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
  },
});
