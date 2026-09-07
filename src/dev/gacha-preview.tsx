import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GiftOpeningStage, StorybookBackdrop } from '@/components/screens/gacha/storybook-draw';
import { Button } from '@/components/ui/button';
import { GachaSceneColors, Spacing } from '@/constants/theme';
import { useTypography } from '@/hooks/use-tokens';

/** Previous illustrated stage stays available for art comparison, not paid draws. */
export function GachaStorybookPreview() {
  const Typography = useTypography();
  const [opened, setOpened] = useState(false);
  return (
    <View style={styles.root}>
      <StorybookBackdrop />
      <Text style={[Typography.supporting, styles.caption]}>
        이전 숲속 아트 비교용 · 실제 뽑기 화면에서는 사용하지 않아요
      </Text>
      <GiftOpeningStage phase={opened ? 'opening' : 'ready'} onOpen={() => setOpened(true)} />
      {opened ? <Button label="다시 보기" onPress={() => setOpened(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch', alignItems: 'center', padding: Spacing.three, gap: Spacing.two },
  caption: { color: GachaSceneColors.ink, textAlign: 'center' },
});
