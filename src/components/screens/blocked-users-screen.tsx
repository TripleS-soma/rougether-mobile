import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { FeedAvatar } from '@/components/feed/feed-parts';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Loading } from '@/components/ui/loading';
import { RetryState } from '@/components/ui/retry-state';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Radius, Spacing } from '@/constants/theme';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

/** 차단한 사용자 한 명 (GET /me/blocks 항목을 굳힌 모양). */
export type BlockedUser = {
  userId: number;
  /** null 가능(탈퇴 직후 등) — 화면이 '알 수 없는 사용자'로 표시한다. */
  nickname: string | null;
  profileImageKey: string | null;
  /** ISO-8601 UTC. */
  blockedAt: string;
};

const NO_USERS: BlockedUser[] = [];

export type BlockedUsersScreenProps = {
  users?: BlockedUser[];
  loading?: boolean;
  loadError?: boolean;
  onRetry?: () => void;
  hasNext?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  /** 차단 해제 — 확인 다이얼로그를 통과했을 때만 호출된다. 결과 안내는 셸 몫. */
  onUnblock?: (userId: number) => void;
  onBack?: () => void;
};

/**
 * 설정 > 차단한 사용자 (#1428) — 최근 차단순 목록과 차단 해제. 해제하면 그 사람의 글·댓글이
 * 피드에 다시 보인다(서버 즉시 반영). 순수·prop 기반.
 */
export function BlockedUsersScreen({
  users = NO_USERS,
  loading = false,
  loadError = false,
  onRetry,
  hasNext = false,
  loadingMore = false,
  onLoadMore,
  onUnblock,
  onBack,
}: BlockedUsersScreenProps) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  const column = useResponsiveColumn();
  const headerInset = useHeaderContentInset();
  const screenStyle = useScreenStyle([]);
  const [confirmUser, setConfirmUser] = useState<BlockedUser | null>(null);
  const anonymous = tr('member.moderation.blockedUsers.anonymous');
  const nameOf = (u: BlockedUser) => u.nickname ?? anonymous;

  const empty = loading ? (
    <Loading />
  ) : loadError ? (
    <RetryState message={tr('member.moderation.blockedUsers.loadError')} onRetry={onRetry} />
  ) : (
    <View style={styles.empty}>
      <Text style={[Typography.label, styles.center, { color: t.text }]}>
        {tr('member.moderation.blockedUsers.empty')}
      </Text>
      <Text style={[Typography.supporting, styles.center, { color: t.textMuted }]}>
        {tr('member.moderation.blockedUsers.emptyBody')}
      </Text>
    </View>
  );

  return (
    <View style={[styles.screen, screenStyle]}>
      <ScreenHeader title={tr('member.moderation.blockedUsers.title')} onBack={onBack} />
      <FlatList
        data={users}
        keyExtractor={(u) => String(u.userId)}
        contentContainerStyle={[
          styles.body,
          column,
          headerInset ? { paddingTop: headerInset } : null,
        ]}
        ListEmptyComponent={empty}
        ListFooterComponent={
          hasNext && users.length > 0 ? (
            loadingMore ? (
              <Loading />
            ) : (
              <Pressable
                onPress={onLoadMore}
                accessibilityRole="button"
                style={[styles.more, { backgroundColor: t.surfaceMuted }]}>
                <Text style={[Typography.label, { color: t.primaryText }]}>
                  {tr('member.moderation.blockedUsers.more')}
                </Text>
              </Pressable>
            )
          ) : null
        }
        renderItem={({ item: u }) => (
          <View style={[styles.row, { backgroundColor: t.surface }]}>
            <FeedAvatar author={{ ...u, nickname: nameOf(u) }} />
            <Text style={[Typography.label, styles.name, { color: t.text }]} numberOfLines={1}>
              {nameOf(u)}
            </Text>
            {onUnblock ? (
              <Pressable
                onPress={() => setConfirmUser(u)}
                accessibilityRole="button"
                accessibilityLabel={tr('member.moderation.blockedUsers.unblockA11y', {
                  name: nameOf(u),
                })}
                style={[styles.unblock, { backgroundColor: t.surfaceMuted }]}>
                <Text style={[Typography.label, { color: t.text }]}>
                  {tr('member.moderation.blockedUsers.unblock')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}
      />
      <ConfirmDialog
        visible={confirmUser !== null}
        title={tr('member.moderation.blockedUsers.unblockTitle')}
        body={tr('member.moderation.blockedUsers.unblockBody', {
          name: confirmUser ? nameOf(confirmUser) : '',
        })}
        confirmLabel={tr('member.moderation.blockedUsers.unblock')}
        onCancel={() => setConfirmUser(null)}
        onConfirm={() => {
          const u = confirmUser;
          setConfirmUser(null);
          if (u) onUnblock?.(u.userId);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  body: {
    padding: Spacing.three,
    gap: Spacing.two,
    paddingBottom: Spacing.six,
  },
  center: {
    textAlign: 'center',
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingTop: Spacing.six,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.lg,
  },
  name: {
    flex: 1,
  },
  unblock: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
  },
  more: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
});
