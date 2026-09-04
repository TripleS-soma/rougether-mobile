import { ScrollView, StyleSheet, View } from 'react-native';

import {
  WeeklyReportPanel,
  type WeeklyReportPanelProps,
} from '@/components/screens/my-room/weekly-report-panel';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Spacing } from '@/constants/theme';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';

export type WeeklyReportScreenProps = WeeklyReportPanelProps & {
  onBack?: () => void;
};

/**
 * 주간회고 화면 (#1056) — 나의 방의 주간회고 탭이 사라지며 설정 > 주간회고
 * 다시 보기와 새 회고 인앱 배너가 여기로 온다. 본문은 종전 탭 패널
 * (`WeeklyReportPanel`: 회고 + AI 조정 제안 #1006) 그대로. Pure + prop-driven.
 */
export function WeeklyReportScreen({ onBack, ...panel }: WeeklyReportScreenProps) {
  const column = useResponsiveColumn();
  // 떠 있는 글래스 헤더(#1069) 밑으로 콘텐츠가 지나가도록 상단 패딩.
  const headerInset = useHeaderContentInset();
  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <ScreenHeader title="주간회고" onBack={onBack} />
      <ScrollView
        contentContainerStyle={[
          styles.body,
          column,
          headerInset ? { paddingTop: headerInset } : null,
        ]}>
        <WeeklyReportPanel {...panel} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  body: {
    paddingBottom: Spacing.six,
  },
});
