import { useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { PeperoGiftPopup } from '@/components/screens/events/pepero-gift-popup';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { RoomQuickTodoPreview } from '@/dev/todo-compose-preview';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

/** Fixture-only: opening, closing and navigating here never touch real rewards. */
export function PeperoGiftPreview() {
  const { height } = useWindowDimensions();
  const [visible, setVisible] = useState(true);
  const [decor, setDecor] = useState(false);
  const [hidden, setHidden] = useState(false);
  const t = useTokens();
  const typography = useTypography();
  const tr = useT();
  return (
    <View style={{ height, alignSelf: 'stretch' }}>
      <RoomQuickTodoPreview />
      {!visible ? (
        <View style={[styles.launch, { backgroundColor: t.screen }]}>
          {decor ? (
            <Text style={[typography.body, { color: t.text }]}>{tr('pepero.goDecor')}</Text>
          ) : null}
          <Button
            label={tr('pepero.title')}
            onPress={() => {
              setHidden(false);
              setVisible(true);
            }}
            disabled={hidden}
          />
        </View>
      ) : null}
      <PeperoGiftPopup
        visible={visible}
        onClose={(hide) => {
          setHidden(hide);
          setVisible(false);
        }}
        onGoDecor={(hide) => {
          setHidden(hide);
          setDecor(true);
          setVisible(false);
        }}
        onDismissed={() => undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  launch: {
    position: 'absolute',
    bottom: Spacing.four,
    alignSelf: 'center',
    padding: Spacing.three,
    gap: Spacing.two,
  },
});
