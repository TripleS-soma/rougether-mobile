import Ionicons from '@expo/vector-icons/Ionicons';

import { CoinIcon } from '@/components/ui/coin-icon';
import { useTokens } from '@/hooks/use-tokens';

/**
 * App-semantic icon names mapped to the underlying icon set (Ionicons). Screens
 * reference meaning ("back", "edit") not glyphs, so the icon set can be swapped
 * in one place and emoji glyphs are avoided.
 */
const ICONS = {
  back: 'chevron-back',
  forward: 'chevron-forward',
  close: 'close',
  edit: 'pencil',
  menu: 'menu-outline',
  list: 'list-outline',
  folder: 'folder-open-outline',
  add: 'add',
  subtract: 'remove',
  search: 'search',
  members: 'people',
  kebab: 'ellipsis-vertical',
  gift: 'gift',
  gamepad: 'game-controller-outline',
  sparkles: 'sparkles-outline',
  ticket: 'ticket-outline',
  trash: 'trash-outline',
  check: 'checkmark',
  success: 'checkmark-circle',
  copy: 'copy-outline',
  'checkbox-off': 'square-outline',
  bell: 'notifications-outline',
  'bell-off': 'notifications-off-outline',
  camera: 'camera-outline',
  calendar: 'calendar-outline',
  leaf: 'leaf',
  flame: 'flame',
  star: 'star',
  leave: 'exit-outline',
  heart: 'heart',
  // 피드 (#1409)
  'heart-outline': 'heart-outline',
  comment: 'chatbubble-outline',
  image: 'image-outline',
  // 집 채팅 — 담아 둔 사진 자르기
  // 메신저식 보내기 — 위로 솟는 화살표
  'send-up': 'arrow-up',
  // 말풍선 길게 누르기 메뉴 — 다른 앱으로 공유
  share: 'share-outline',
  crop: 'crop-outline',
  // 방 꾸미기 선택 툴바 (#333)
  flip: 'swap-horizontal',
  'rotate-ccw': 'arrow-undo-outline',
  'rotate-cw': 'arrow-redo-outline',
  'layer-up': 'arrow-up',
  'layer-down': 'arrow-down',
  // 꾸미기 실행 취소·다시 실행 (#1640) — 회전(arrow-undo-outline)과 구분되게 채운 화살표.
  undo: 'arrow-undo',
  redo: 'arrow-redo',
  // 카테고리 순서 옮기기 (#1613)
  'move-up': 'caret-up',
  'move-down': 'caret-down',
  // Currency + shop
  coin: 'ellipse', // 실제 렌더는 CoinIcon(#512) — IconName 타입 유지용 매핑.
  diamond: 'diamond',
  shop: 'storefront-outline',
  // Settings menu rows
  profile: 'person-outline',
  lock: 'lock-closed-outline',
  sound: 'volume-high-outline',
  help: 'help-circle-outline',
  bug: 'bug-outline',
  // 신고·차단 (#1428).
  flag: 'flag-outline',
  block: 'ban-outline',
  palette: 'color-palette-outline',
  moon: 'moon-outline',
  refresh: 'refresh-outline',
  // 집 채팅 (#1408)
  chat: 'chatbubbles-outline',
  send: 'send',
  // 집 피드 — 레일 버튼, 작성 화면의 올릴 곳(전체 공개)
  'house-feed': 'reader-outline',
  globe: 'globe-outline',
  // 미니게임 규칙 표식 (#1613)
  tap: 'hand-left-outline',
  finish: 'flag',
  home: 'home-outline',
  // Bottom-nav
  myRoom: 'home',
  house: 'business',
  settings: 'settings-outline',
} as const satisfies Record<string, keyof typeof Ionicons.glyphMap>;

export type IconName = keyof typeof ICONS;

export type IconProps = {
  name: IconName;
  size?: number;
  /** Defaults to the theme icon color. */
  color?: string;
};

export function Icon({ name, size = 22, color }: IconProps) {
  const t = useTokens();
  // 코인은 커스텀 동전 글리프 (#512) — Ionicons에 동전형이 없어 발바닥 각인
  // 동전으로 그린다. 색 관례(t.warning 전달)는 그대로 fill로 흐른다.
  if (name === 'coin') return <CoinIcon size={size} color={color ?? t.warning} />;
  return <Ionicons name={ICONS[name]} size={size} color={color ?? t.icon} />;
}
