import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ChristmasModalFrame } from '@/components/screens/christmas/christmas-modal-frame';
import { ChristmasRoomHero } from '@/components/screens/gacha/christmas-room-hero';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { ScalePressable } from '@/components/ui/scale-pressable';
import { Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

export type ChristmasEventPopupProps = {
  visible: boolean;
  title: string;
  endsOn: string;
  dismissing?: boolean;
  error?: boolean | string;
  onClose: (permanent: boolean) => void;
  onDismissed: () => void;
  onGoEvent: (permanent: boolean) => void;
};

/** Only this announcement owns the account-wide permanent dismissal checkbox. */
export function ChristmasEventPopup({
  visible,
  title,
  endsOn,
  dismissing = false,
  error = false,
  onClose,
  onDismissed,
  onGoEvent,
}: ChristmasEventPopupProps) {
  const tr = useT();
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const [permanent, setPermanent] = useState(false);
  useEffect(() => {
    if (visible) setPermanent(false);
  }, [visible]);
  const close = () => {
    if (!dismissing) onClose(permanent);
  };
  return (
    <ChristmasModalFrame visible={visible} label={title} onClose={close} onDismissed={onDismissed}>
      <ScrollView bounces={false}>
        <View style={styles.hero}>
          <ChristmasRoomHero />
          <ScalePressable
            accessibilityRole="button"
            accessibilityLabel={tr('christmas.close')}
            disabled={dismissing}
            onPress={close}
            style={[styles.cornerClose, { backgroundColor: t.surface }]}>
            <Icon name="close" size={24} color={t.text} />
          </ScalePressable>
        </View>
        <View style={styles.content}>
          <Text
            accessibilityRole="header"
            style={[Typography.h2, emph('bold'), styles.center, { color: t.text }]}>
            {tr('christmas.popupHeading')}
          </Text>
          <Text style={[Typography.supporting, styles.center, { color: t.textMuted }]}>
            {tr('christmas.endsOn', { date: endsOn.slice(5).replace('-', '.') })}
          </Text>
          <Button
            label={tr('christmas.goEvent')}
            disabled={dismissing}
            onPress={() => onGoEvent(permanent)}
          />
          {error ? (
            <View style={styles.error}>
              <Text
                accessibilityLiveRegion="polite"
                style={[Typography.supporting, { color: t.danger }]}>
                {tr('christmas.dismissError')}
              </Text>
              <Button
                label={tr('christmas.retry')}
                variant="secondary"
                disabled={dismissing}
                onPress={close}
              />
            </View>
          ) : null}
          <View style={[styles.bottom, { borderTopColor: t.border }]}>
            <ScalePressable
              accessibilityRole="checkbox"
              accessibilityLabel={tr('christmas.neverShow')}
              accessibilityState={{ checked: permanent, disabled: dismissing }}
              aria-checked={permanent}
              disabled={dismissing}
              onPress={() => setPermanent((value) => !value)}
              style={styles.checkbox}>
              <Icon name={permanent ? 'check' : 'checkbox-off'} size={22} color={t.textMuted} />
              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                {tr('christmas.neverShow')}
              </Text>
            </ScalePressable>
            <ScalePressable
              accessibilityRole="button"
              disabled={dismissing}
              onPress={close}
              style={styles.close}>
              <Text style={[Typography.supporting, { color: t.text }]}>
                {dismissing ? tr('christmas.saving') : tr('christmas.close')}
              </Text>
            </ScalePressable>
          </View>
        </View>
      </ScrollView>
    </ChristmasModalFrame>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', aspectRatio: 4 / 3 },
  cornerClose: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    padding: Spacing.two,
    borderRadius: Spacing.four,
  },
  content: { padding: Spacing.three, gap: Spacing.three },
  center: { textAlign: 'center' },
  bottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: Spacing.two,
  },
  checkbox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 44 },
  close: { padding: Spacing.two },
  error: { gap: Spacing.two },
});
