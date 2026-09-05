import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SettingsScreen } from '@/components/screens/settings-screen';
import { Radius, Spacing } from '@/constants/theme';
import { useBrandTheme, useTokens, useTypography } from '@/hooks/use-tokens';
import type { AppUpdateState, AppUpdateStatus } from '@/types/app-update';

const STATES: { status: AppUpdateStatus; label: string }[] = [
  { status: 'idle', label: '대기' },
  { status: 'checking', label: '확인 중' },
  { status: 'downloading', label: '다운로드' },
  { status: 'ready', label: '적용 준비' },
  { status: 'no-update', label: '없음' },
  { status: 'error', label: '오류' },
  { status: 'unsupported', label: '미지원' },
];
const INFO: AppUpdateState['info'] = {
  appVersion: '1.4.0',
  channel: 'preview (미리보기)',
  runtimeVersion: '7d725a8e14bc742be3dd978f3db192a36e41ca76',
  updateId: '01a06fb6-cc40-7515-9bbd-56ffb9b9f36d',
  embedded: false,
  emergencyLaunch: false,
};

/** Local UI fixture. It never fetches a real OTA, reloads, or calls the business API. */
export function SettingsUpdatePreview() {
  const [status, setStatus] = useState<AppUpdateStatus>('idle');
  const [applied, setApplied] = useState(0);
  const { mode, setMode, themeId, fontId, setThemeId, setFontId } = useBrandTheme();
  const t = useTokens();
  const typography = useTypography();
  return (
    <View style={[styles.root, { backgroundColor: t.screen }]}>
      <View style={styles.toolbar}>
        <Text testID="settings-preview-status" style={[typography.supporting, { color: t.text }]}>
          개발 미리보기 · 실제 업데이트 없음 · 적용 확인 {applied}회
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.choices}>
          {STATES.map((item) => (
            <Pressable
              key={item.status}
              accessibilityRole="button"
              accessibilityLabel={`미리보기 ${item.label}`}
              onPress={() => setStatus(item.status)}
              style={[
                styles.choice,
                { backgroundColor: status === item.status ? t.primary : t.surfaceMuted },
              ]}>
              <Text
                style={[
                  typography.label,
                  { color: status === item.status ? t.onPrimary : t.text },
                ]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <SettingsScreen
        themeMode={mode}
        onChangeThemeMode={setMode}
        themeId={themeId}
        fontId={fontId}
        onOpenTheme={() => setThemeId(themeId === 'cozy' ? 'indigo' : 'cozy')}
        onOpenFont={() => setFontId(fontId === 'suit' ? 'jua' : 'suit')}
        appUpdate={{
          status,
          info: INFO,
          progress: status === 'downloading' ? 0.42 : undefined,
          error:
            status === 'error'
              ? '업데이트를 확인하지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.'
              : undefined,
        }}
        onCheckForUpdate={() => setStatus('ready')}
        onApplyUpdate={() => {
          setApplied((value) => value + 1);
          setStatus('idle');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: Spacing.six * 10, width: '100%' },
  toolbar: { padding: Spacing.three, gap: Spacing.two },
  choices: { gap: Spacing.two },
  choice: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
