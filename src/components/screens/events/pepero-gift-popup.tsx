import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { ChristmasModalFrame } from '@/components/screens/christmas/christmas-modal-frame';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { ScalePressable } from '@/components/ui/scale-pressable';
import { Radius, Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

export type PeperoGiftPopupProps = {
  visible: boolean;
  dismissing?: boolean;
  error?: boolean;
  onClose: (hideToday: boolean) => void;
  onGoDecor: (hideToday: boolean) => void;
  onDismissed: () => void;
};

/** Success-only popup: the surface supplies a server-confirmed gift receipt. */
export function PeperoGiftPopup({
  visible,
  dismissing = false,
  error = false,
  onClose,
  onGoDecor,
  onDismissed,
}: PeperoGiftPopupProps) {
  const t = useTokens();
  const Typography = useTypography();
  const { width } = useWindowDimensions();
  const emph = useFontEmphasis();
  const tr = useT();
  const [hideToday, setHideToday] = useState(false);
  useEffect(() => {
    if (visible) setHideToday(false);
  }, [visible]);
  const close = () => {
    if (!dismissing) onClose(hideToday);
  };
  return (
    <ChristmasModalFrame
      visible={visible}
      label={tr('pepero.title')}
      onClose={close}
      onDismissed={onDismissed}>
      <ScrollView bounces={false} contentContainerStyle={styles.content}>
        <ScalePressable
          accessibilityRole="button"
          accessibilityLabel={tr('pepero.close')}
          disabled={dismissing}
          onPress={close}
          style={styles.cornerClose}>
          <Icon name="close" size={24} color={t.textMuted} />
        </ScalePressable>
        <View style={styles.heading}>
          <View style={[styles.eyebrow, { backgroundColor: t.surfaceMuted }]}>
            <Text style={[Typography.supporting, emph('bold'), { color: t.text }]}>
              {tr('pepero.title')}
            </Text>
          </View>
          <Text
            accessibilityRole="header"
            style={[
              width < 360 ? Typography.h2 : Typography.h1,
              emph('bold'),
              styles.center,
              { color: t.text },
            ]}>
            {tr('pepero.heading')}
          </Text>
        </View>
        <Image
          source={require('@/assets/images/events/pepero-day-20261111/login-gift-hero.png')}
          style={styles.hero}
          contentFit="contain"
          accessibilityLabel={tr('pepero.heroLabel')}
        />
        <View>
          {['coins', 'furniture'].map((key) => (
            <View key={key} style={[styles.rewardRow, { borderColor: t.border }]}>
              <Icon name="success" size={22} color={t.primary} />
              <Text
                style={[Typography.supporting, emph('bold'), styles.rewardName, { color: t.text }]}>
                {tr(`pepero.${key}`)}
              </Text>
              <Text style={[Typography.caption, { color: t.textMuted }]}>
                {tr('pepero.received')}
              </Text>
            </View>
          ))}
        </View>
        <Text style={[Typography.supporting, styles.center, { color: t.text }]}>
          {tr('pepero.description')}
        </Text>
        <Button
          label={tr('pepero.goDecor')}
          disabled={dismissing}
          onPress={() => onGoDecor(hideToday)}
          style={styles.primary}
        />
        {error ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[Typography.supporting, { color: t.danger }]}>
            {tr('pepero.dismissError')}
          </Text>
        ) : null}
        <View style={[styles.footer, { borderTopColor: t.border }]}>
          <ScalePressable
            accessibilityRole="checkbox"
            accessibilityLabel={tr('pepero.hideToday')}
            accessibilityState={{ checked: hideToday, disabled: dismissing }}
            aria-checked={hideToday}
            disabled={dismissing}
            onPress={() => setHideToday((value) => !value)}
            style={styles.checkbox}>
            <Icon name={hideToday ? 'check' : 'checkbox-off'} size={22} color={t.textMuted} />
            <Text style={[Typography.supporting, { color: t.textMuted }]}>
              {tr('pepero.hideToday')}
            </Text>
          </ScalePressable>
          <ScalePressable
            accessibilityRole="button"
            onPress={close}
            disabled={dismissing}
            style={styles.close}>
            <Text style={[Typography.supporting, { color: t.text }]}>
              {dismissing ? tr('pepero.saving') : tr('pepero.close')}
            </Text>
          </ScalePressable>
        </View>
      </ScrollView>
    </ChristmasModalFrame>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.three },
  cornerClose: {
    position: 'absolute',
    right: Spacing.two,
    top: Spacing.two,
    padding: Spacing.two,
    zIndex: 1,
  },
  heading: { alignItems: 'center', gap: Spacing.three, paddingTop: Spacing.three },
  eyebrow: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  center: { textAlign: 'center' },
  hero: { width: '100%', aspectRatio: 1561 / 1007 },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
  },
  rewardName: { flex: 1 },
  primary: { borderRadius: Radius.lg },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: Spacing.two,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
    flexShrink: 1,
  },
  close: { padding: Spacing.two, minHeight: 44, justifyContent: 'center' },
});
