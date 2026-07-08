import Ionicons from '@expo/vector-icons/Ionicons';

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
  search: 'search',
  members: 'people',
  kebab: 'ellipsis-vertical',
  gift: 'gift',
  trash: 'trash-outline',
  check: 'checkmark',
  'checkbox-on': 'checkbox',
  'checkbox-off': 'square-outline',
  bell: 'notifications-outline',
  'bell-off': 'notifications-off-outline',
  camera: 'camera-outline',
  calendar: 'calendar-outline',
  leaf: 'leaf',
  flame: 'flame',
  star: 'star',
  leave: 'exit-outline',
  // Currency + shop
  coin: 'ellipse',
  dia: 'diamond',
  shop: 'storefront-outline',
  // Settings menu rows
  profile: 'person-outline',
  lock: 'lock-closed-outline',
  sound: 'volume-high-outline',
  help: 'help-circle-outline',
  palette: 'color-palette-outline',
  moon: 'moon-outline',
  refresh: 'refresh-outline',
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
  return <Ionicons name={ICONS[name]} size={size} color={color ?? t.icon} />;
}
