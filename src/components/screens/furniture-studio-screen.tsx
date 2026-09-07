import { Image } from 'expo-image';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import type {
  FurnitureCreditBalance,
  FurnitureJob,
  FurniturePhoto,
} from '@/api/furniture-generation';
import { isFurnitureJobActive } from '@/api/furniture-generation';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Radius, Spacing } from '@/constants/theme';
import { useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { assetSource } from '@/resources/asset';

export type FurnitureStudioScreenProps = {
  balance: FurnitureCreditBalance | null;
  jobs: FurnitureJob[];
  photo: FurniturePhoto | null;
  loading?: boolean;
  submitting?: boolean;
  error?: string | null;
  onChoosePhoto?: () => void;
  onSubmit?: () => void;
  onRetry?: () => void;
  onAttendance?: () => void;
  onGoToRoom?: () => void;
  onBack?: () => void;
};

export function FurnitureStudioScreen({
  balance,
  jobs,
  photo,
  loading,
  submitting,
  error,
  onChoosePhoto,
  onSubmit,
  onRetry,
  onAttendance,
  onGoToRoom,
  onBack,
}: FurnitureStudioScreenProps) {
  const t = useTokens();
  const Typography = useTypography();
  const column = useResponsiveColumn();
  const inset = useHeaderContentInset();
  const screenStyle = useScreenStyle([]);
  const active = jobs.find(isFurnitureJobActive);
  const ready = !loading && !submitting && !active && (balance?.available ?? 0) > 0;
  return (
    <View style={[styles.screen, screenStyle]}>
      <ScreenHeader title="AI 가구 만들기" onBack={onBack} />
      <ScrollView
        contentContainerStyle={[styles.body, column, { paddingTop: inset || Spacing.four }]}>
        <View style={[styles.hero, { backgroundColor: t.surfaceMuted }]}>
          <Icon name="sparkles" size={36} color={t.primaryText} />
          <Text style={[Typography.h2, { color: t.text }]}>사진 속 가구를 내 방으로</Text>
          <Text style={[Typography.body, styles.center, { color: t.textMuted }]}>
            좋아하는 가구 사진 한 장으로{`\n`}루게더 속 나만의 가구를 만들어보세요.
          </Text>
          <View style={[styles.balance, { backgroundColor: t.surface }]}>
            <Icon name="ticket" size={18} color={t.primaryText} />
            <Text style={[Typography.label, { color: t.text }]}>
              {balance ? `생성권 ${balance.available}회` : '생성권 확인 중'}
              {balance && balance.reserved > 0 ? ` · 사용 중 ${balance.reserved}회` : ''}
            </Text>
          </View>
        </View>
        {loading ? (
          <ActivityIndicator accessibilityLabel="생성권 불러오는 중" color={t.primaryText} />
        ) : null}
        {error ? (
          <View accessibilityRole="alert" style={styles.section}>
            <Text style={[Typography.body, { color: t.danger }]}>{error}</Text>
            <Button label="다시 확인" variant="secondary" onPress={onRetry} disabled={submitting} />
          </View>
        ) : null}
        {active ? (
          <View style={[styles.card, { backgroundColor: t.surface }]}>
            <ActivityIndicator color={t.primaryText} />
            <Text style={[Typography.h3, { color: t.text }]}>가구를 만들고 있어요</Text>
            <Text style={[Typography.body, { color: t.textMuted }]}>
              잠시 걸릴 수 있어요. 다른 화면에 다녀와도 계속 만들어요.
            </Text>
          </View>
        ) : (
          <View style={styles.section}>
            {photo ? (
              <Image
                source={{ uri: photo.uri }}
                style={styles.photo}
                contentFit="contain"
                accessibilityLabel="선택한 가구 사진"
              />
            ) : null}
            <Button
              label={photo ? '사진 바꾸기' : '가구 사진 선택'}
              leftIcon="camera"
              variant="secondary"
              onPress={onChoosePhoto}
              disabled={!ready}
            />
            {photo ? (
              <Button
                label={submitting ? '사진 보내는 중' : '생성권 1회로 만들기'}
                leftIcon="sparkles"
                onPress={onSubmit}
                disabled={!ready}
              />
            ) : null}
            <Text style={[Typography.supporting, { color: t.textMuted }]}>
              가구 하나가 잘 보이는 JPG·PNG 사진 · 최대 10MB{`\n`}사진은 AI 가구 제작에 사용돼요.
              생성에 실패하면 생성권을 돌려드려요.
            </Text>
          </View>
        )}
        {onAttendance ? (
          <View style={[styles.card, { backgroundColor: t.surfaceMuted }]}>
            <Text style={[Typography.h3, { color: t.text }]}>7일 출석하고, 내 가구 만들기</Text>
            <Text style={[Typography.body, { color: t.textMuted }]}>
              7일 연속 출석하면 생성권 1회를 받아요.
            </Text>
            <Button label="출석 이벤트 보기" variant="secondary" onPress={onAttendance} />
          </View>
        ) : null}
        {jobs.length ? (
          <Text style={[Typography.h3, { color: t.text }]}>내가 만든 가구</Text>
        ) : null}
        {jobs
          .filter((job) => !isFurnitureJobActive(job))
          .map((job) => (
            <View key={job.id} style={[styles.card, { backgroundColor: t.surface }]}>
              {job.assetKey ? (
                <Image
                  source={assetSource(job.assetKey)}
                  style={styles.result}
                  contentFit="contain"
                  accessibilityLabel="완성된 AI 가구"
                />
              ) : null}
              <Text style={[Typography.label, { color: t.text }]}>
                {job.status === 'SUCCEEDED' ? '내 가구함에 담았어요' : '이번에는 완성하지 못했어요'}
              </Text>
              {job.status === 'SUCCEEDED' || job.userItemId ? (
                <Button label="방에 배치하기" onPress={onGoToRoom} variant="secondary" />
              ) : (
                <Text style={[Typography.body, { color: t.textMuted }]}>
                  사진을 바꿔 다시 시도해보세요.
                </Text>
              )}
            </View>
          ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: {
    padding: Spacing.four,
    gap: Spacing.four,
    paddingBottom: Spacing.six,
  },
  hero: {
    padding: Spacing.four,
    borderRadius: Radius.xl,
    gap: Spacing.three,
    alignItems: 'center',
  },
  center: { textAlign: 'center' },
  balance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Radius.pill,
  },
  section: { gap: Spacing.two },
  card: { padding: Spacing.three, borderRadius: Radius.lg, gap: Spacing.two },
  photo: { width: '100%', aspectRatio: 1, borderRadius: Radius.lg },
  result: { width: '100%', height: 160 },
});
