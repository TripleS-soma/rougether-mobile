import type { ImageSourcePropType } from 'react-native';

/** Bundled artwork; the server persists only these stable keys. */
export const CHAT_EMOTICONS = [
  { key: 'ruyang_hi', labelKey: 'hi', source: require('@/assets/chat/ruyang-v2/ruyang_hi.webp') },
  {
    key: 'ruyang_like',
    labelKey: 'like',
    source: require('@/assets/chat/ruyang-v2/ruyang_like.webp'),
  },
  {
    key: 'ruyang_cheer',
    labelKey: 'cheer',
    source: require('@/assets/chat/ruyang-v2/ruyang_cheer.webp'),
  },
  {
    key: 'ruyang_done',
    labelKey: 'done',
    source: require('@/assets/chat/ruyang-v2/ruyang_done.webp'),
  },
  {
    key: 'ruyang_thanks',
    labelKey: 'thanks',
    source: require('@/assets/chat/ruyang-v2/ruyang_thanks.webp'),
  },
  {
    key: 'ruyang_goodjob',
    labelKey: 'goodjob',
    source: require('@/assets/chat/ruyang-v2/ruyang_goodjob.webp'),
  },
  {
    key: 'ruyang_sad',
    labelKey: 'sad',
    source: require('@/assets/chat/ruyang-v2/ruyang_sad.webp'),
  },
  {
    key: 'ruyang_goodnight',
    labelKey: 'goodnight',
    source: require('@/assets/chat/ruyang-v2/ruyang_goodnight.webp'),
  },
] as const satisfies readonly { key: string; labelKey: string; source: ImageSourcePropType }[];

export type ChatEmoticon = (typeof CHAT_EMOTICONS)[number];
export type ChatEmoticonKey = ChatEmoticon['key'];

export function chatEmoticonOf(key: string | null | undefined): ChatEmoticon | undefined {
  return CHAT_EMOTICONS.find((item) => item.key === key);
}
