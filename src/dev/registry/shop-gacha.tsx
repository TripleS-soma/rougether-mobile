import { useState } from 'react';
import { Text, View } from 'react-native';
import { GachaPhonePreview } from '@/dev/gacha-phone-preview';
import { GachaStorybookPreview } from '@/dev/gacha-preview';
import { ScalePressable } from '@/components/ui/scale-pressable';
import { CurrencyGuide } from '@/components/ui/currency-guide';
import { WalletHistorySheet } from '@/components/screens/sheets/wallet-history-sheet';
import type { GalleryEntry } from '@/dev/registry/types';

/** 재화 내역 시트 데모 (#734). */
function WalletHistorySheetDemo() {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <ScalePressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={{ alignSelf: 'center', padding: 8 }}>
        <Text>재화 내역 열기</Text>
      </ScalePressable>
      <WalletHistorySheet
        visible={open}
        onClose={() => setOpen(false)}
        entries={[
          { id: 1, currency: 'coin', amount: 10, reason: '루틴 완료', balanceAfter: 130, createdAt: new Date().toISOString() }, // prettier-ignore
          { id: 2, currency: 'coin', amount: -100, reason: '뽑기', balanceAfter: 120, createdAt: new Date(Date.now() - 3600e3).toISOString() }, // prettier-ignore
          { id: 3, currency: 'diamond', amount: 5, reason: '뽑기 중복 전환', balanceAfter: 25, createdAt: new Date(Date.now() - 86400e3).toISOString() }, // prettier-ignore
        ]}
        hasNext
      />
    </View>
  );
}

export const shopGachaEntries: GalleryEntry[] = [
  {
    name: 'WalletHistorySheet · 재화 내역',
    description: '지갑 필 탭 → 재화 증감 이력 시트 (#734) — 적립 +/사용 −, 직후 잔액, 더보기.',
    render: () => <WalletHistorySheetDemo />,
  },
  {
    name: 'CurrencyGuide · 재화 안내',
    description: '재화 내역 시트 상단 접이식 안내 (#789) — 코인·다이아의 수급처·사용처.',
    render: () => <CurrencyGuide initialOpen />,
  },
  {
    name: 'GachaScreen',
    description:
      '테마 구분 없는 벽지·바닥·가구 3개 상자. 실제 재화 소모 없이 단챠·5+1·보상 목록을 확인한다.',
    render: () => <GachaPhonePreview />,
  },
  {
    name: 'GachaPhonePreview',
    description: '전체 화면 휴대폰 QA · 5+1 순차 차임과 일괄 결과 · 전설 연출 · 상단 59 / 하단 34',
    render: () => <GachaPhonePreview fullscreen />,
  },
  {
    name: 'GachaPhoneCommon',
    description: '전체 화면 휴대폰 QA · 일반 연출',
    render: () => <GachaPhonePreview fullscreen rarity="일반" />,
  },
  {
    name: 'GachaPhoneRare',
    description: '전체 화면 휴대폰 QA · 희귀 연출',
    render: () => <GachaPhonePreview fullscreen rarity="희귀" />,
  },
  {
    name: 'GachaPhoneReducedMotion',
    description: '전체 화면 휴대폰 QA · 동작 줄이기',
    render: () => <GachaPhonePreview fullscreen reducedMotion />,
  },
  {
    name: 'GachaStorybookArchive',
    description: '이전 PR의 숲속 선물상자 아트 비교용. 실제 유료 뽑기와 분리된 개발 전용 무대.',
    render: () => <GachaStorybookPreview />,
  },
];
