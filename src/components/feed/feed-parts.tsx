import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { FeedAuthor } from '@/components/screens/feed/types';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';
import { assetSource, isCdnKey } from '@/resources/asset';
import { relativeTimeLabel } from '@/utils/datetime';

const AVATAR_SIZE = 36;

/** 작성자 표시 이름 — 닉네임이 없으면(null·탈퇴 직후) 앱 기본 표기. */
export function feedAuthorName(author: FeedAuthor, anonymous: string): string {
  return author.nickname ?? anonymous;
}

/** 서버 시각(ISO UTC) → "N분 전" (기기 시간대). 깨진 값이면 빈 문자열. */
export function feedTimeLabel(iso: string, now?: Date): string {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? '' : relativeTimeLabel(at, now);
}

/** 작성자 아바타 — 프로필 사진(CDN 키)이 있으면 그 사진, 없으면 이름 첫 글자. */
export function FeedAvatar({ author, size = AVATAR_SIZE }: { author: FeedAuthor; size?: number }) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  const name = feedAuthorName(author, tr('feed.anonymous'));
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (isCdnKey(author.profileImageKey)) {
    return (
      <Image
        source={assetSource(author.profileImageKey)}
        style={[box, { backgroundColor: t.surfaceMuted }]}
        contentFit="cover"
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={[styles.avatar, box, { backgroundColor: t.primarySoft }]}>
      <Text style={[Typography.label, { color: t.primaryText }]}>{name.slice(0, 1)}</Text>
    </View>
  );
}

/** 작성자 줄 — 아바타 · 이름 · 상대 시각(수정됨 표시). */
export function FeedAuthorRow({
  author,
  createdAt,
  edited,
  now,
}: {
  author: FeedAuthor;
  createdAt: string;
  edited?: boolean;
  now?: Date;
}) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  const time = feedTimeLabel(createdAt, now);
  return (
    <View style={styles.authorRow}>
      <FeedAvatar author={author} />
      <View style={styles.authorText}>
        <Text style={[Typography.label, { color: t.text }]} numberOfLines={1}>
          {feedAuthorName(author, tr('feed.anonymous'))}
        </Text>
        {time ? (
          <Text style={[Typography.supporting, { color: t.textMuted }]} numberOfLines={1}>
            {edited ? `${time} · ${tr('feed.edited')}` : time}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** 좋아요·댓글 수 줄 — 좋아요는 토글, 댓글은 상세로. */
export function FeedActionRow({
  liked,
  likeCount,
  commentCount,
  onToggleLike,
  onOpenComments,
}: {
  liked: boolean;
  likeCount: number;
  commentCount: number;
  onToggleLike?: () => void;
  onOpenComments?: () => void;
}) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  return (
    <View style={styles.actions}>
      <Pressable
        onPress={onToggleLike}
        accessibilityRole="button"
        accessibilityLabel={liked ? tr('feed.unlikeA11y') : tr('feed.likeA11y')}
        accessibilityState={{ selected: liked }}
        hitSlop={Spacing.two}
        style={styles.action}>
        <Icon
          name={liked ? 'heart' : 'heart-outline'}
          size={22}
          color={liked ? t.danger : t.icon}
        />
        <Text style={[Typography.supporting, { color: t.textMuted }]}>
          {tr('feed.likeCount', { count: likeCount })}
        </Text>
      </Pressable>
      <Pressable
        onPress={onOpenComments}
        disabled={!onOpenComments}
        accessibilityRole={onOpenComments ? 'button' : undefined}
        hitSlop={Spacing.two}
        style={styles.action}>
        <Icon name="comment" size={20} color={t.icon} />
        <Text style={[Typography.supporting, { color: t.textMuted }]}>
          {tr('feed.commentCount', { count: commentCount })}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  authorText: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 44,
  },
});
