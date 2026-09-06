import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { TabPager } from '@/components/app/tab-pager';
import { usePagerLock } from '@/components/app/use-pager-lock';
import { BottomNav, type NavTab } from '@/components/ui/bottom-nav';
import { Button } from '@/components/ui/button';
import { PawRefreshScroll } from '@/components/ui/paw-refresh-scroll';
import { PagerScrollView } from '@/components/ui/pager-scroll-view';
import { Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

const TABS: NavTab[] = ['myRoom', 'house', 'myPage'];
const LABELS = ['나의 방', '집', '마이페이지'];

/** Local-only navigation harness: no authentication, API writes or catalog changes. */
export function NavigationPreview() {
  const [index, setIndex] = useState(0);
  const [changes, setChanges] = useState(0);
  const [locked, setLocked] = useState(false);
  const { lock, setHouseLocked } = usePagerLock(TABS[index]);
  const t = useTokens();
  const typography = useTypography();
  const select = (next: number) => {
    setIndex(next);
    setChanges((value) => value + 1);
  };
  return (
    <View style={[styles.root, { backgroundColor: t.screen }]}>
      <Text testID="navigation-status" style={[typography.body, styles.status, { color: t.text }]}>
        {LABELS[index]} · 전환 {changes}회
      </Text>
      <TabPager index={index} onIndexChange={select} lock={lock}>
        {TABS.map((tab, i) => {
          const Scroll = tab === 'myPage' ? PagerScrollView : PawRefreshScroll;
          return (
            <Scroll
              key={tab}
              testID={`navigation-page-${tab}`}
              onRefresh={async () => {}}
              contentContainerStyle={styles.content}>
              <Text style={[typography.h2, { color: t.text }]}>{LABELS[i]} 본문</Text>
              <Text style={[typography.body, { color: t.textMuted }]}>
                본문은 좌우 스와이프, 하단바는 누른 채 끌어 선택해요.
              </Text>
              {tab === 'house' ? (
                <Button
                  label={locked ? '집 확대 잠금 해제' : '집 확대 잠금 재현'}
                  onPress={() => {
                    setHouseLocked(!locked);
                    setLocked(!locked);
                  }}
                />
              ) : null}
              {Array.from({ length: 14 }, (_, row) => (
                <Text key={row} style={[typography.body, styles.row, { color: t.text }]}>
                  {LABELS[i]} 스크롤 항목 {row + 1}
                </Text>
              ))}
            </Scroll>
          );
        })}
      </TabPager>
      <BottomNav active={TABS[index]} onChange={(tab) => select(TABS.indexOf(tab))} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { height: 640, width: '100%' },
  status: { padding: Spacing.four },
  content: { padding: Spacing.four, gap: Spacing.three, paddingBottom: 120 },
  row: { paddingVertical: Spacing.three },
});
