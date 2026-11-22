import { ScrollView, StyleSheet, View } from 'react-native';

import { OwnedCharacterGrid, type OwnedCharacter } from '@/components/member/owned-character-grid';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Spacing } from '@/constants/theme';
import { useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useT } from '@/i18n';

/** 프로필에서 여는 전체 화면. 목록 자체에 별도 높이/스크롤 영역을 만들지 않는다. */
export function CharacterSelectionScreen({
  characters,
  onSelect,
  onBack,
}: {
  characters: OwnedCharacter[];
  onSelect: (serverId: number) => void;
  onBack: () => void;
}) {
  const tr = useT();
  const screenStyle = useScreenStyle(['bottom']);
  const column = useResponsiveColumn();
  const headerInset = useHeaderContentInset();
  return (
    <View style={[styles.screen, screenStyle]}>
      <ScreenHeader title={tr('member.profileEdit.characterSelectTitle')} onBack={onBack} />
      <ScrollView contentContainerStyle={[styles.body, column, { paddingTop: headerInset }]}>
        <OwnedCharacterGrid characters={characters} onSelect={onSelect} />
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { padding: Spacing.four },
});
