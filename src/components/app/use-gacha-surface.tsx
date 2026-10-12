import { type ComponentProps, type Dispatch, type SetStateAction, useMemo, useRef } from 'react';

import { fetchGachaRewards } from '@/api';
import { toGachaMachine } from '@/api/adapters';
import type { Screen } from '@/components/app/navigation';
import { GachaScreen } from '@/components/screens/gacha-screen';
import type { Wallet } from '@/constants/currency';
import { useGacha } from '@/hooks/use-gacha';
import { useStarterGacha } from '@/hooks/use-starter-gacha';
import { useT } from '@/i18n';

type GachaScreenProps = ComponentProps<typeof GachaScreen>;

/**
 * 뽑기 화면 배선 (장부 5번) — 카탈로그·뽑기(useGacha)와 온보딩 첫 뽑기(starter gacha)의
 * 전환, 그리고 화면 JSX를 셸에서 옮겨 왔다. 셸은 `subScreen`을 그리기만 한다.
 */
export function useGachaSurface({
  screen,
  wallet,
  setWallet,
  starterFlow,
  soundEffectsEnabled,
  goBack,
  placeableFurnitureIds,
  goPlaceDrawn,
  onFirstDrawConfirmed,
}: {
  screen: Screen;
  wallet: Wallet;
  setWallet: Dispatch<SetStateAction<Wallet>>;
  /** 온보딩 미션이 '첫 뽑기' 단계인지 (스킵 허용 계정 제외) — 무료 스타터 기계를 띄운다. */
  starterFlow: boolean;
  soundEffectsEnabled: boolean;
  goBack: () => void;
  placeableFurnitureIds: GachaScreenProps['placeableItemIds'];
  goPlaceDrawn: GachaScreenProps['onGoPlace'];
  /** 뽑기 결과 확인 = 미션 2 완료 (#571). */
  onFirstDrawConfirmed: () => void;
}) {
  // 뽑기 카탈로그는 뽑기 화면에 처음 들어갈 때 받는다 (성능 장부 N3) — 한 번 켜면 유지.
  const gachaWanted = useRef(false);
  if (screen === 'gacha') gachaWanted.current = true;
  // Gacha machines + draw (spend + dupe→diamond handled server-side; wallet synced
  // from the draw response).
  const {
    gachas,
    loading: gachasLoading,
    error: gachasError,
    retry: retryGachas,
    draw: drawGachaMachine,
  } = useGacha(setWallet, { enabled: gachaWanted.current });

  const starterGacha = useStarterGacha(starterFlow);
  const starterAllowed =
    starterFlow && !starterGacha.unavailable && starterGacha.state?.state !== 'CLOSED';
  const tr = useT();
  // 언어가 바뀌면 tr 참조가 바뀌어 이름이 다시 계산된다 (#893) — i18n.t를 빈 deps로 굳히지 않는다.
  const starterMachines = useMemo(
    () => [
      toGachaMachine({
        gachaId: -1,
        code: 'onboarding_starter',
        category: 'FURNITURE',
        name: tr('roomShop.gacha.starterMachineName'),
        costCurrencyType: 'COIN',
        costAmount: 0,
        drawCount: 1,
      }),
    ],
    [tr],
  );

  const subScreen =
    screen === 'gacha' ? (
      <GachaScreen
        gachas={starterAllowed ? starterMachines : gachas}
        starterDrawState={
          starterAllowed
            ? starterGacha.state?.state === 'CLAIMED'
              ? 'CLAIMED'
              : 'PENDING'
            : undefined
        }
        loading={starterAllowed ? starterGacha.loading : gachasLoading}
        loadError={starterAllowed ? starterGacha.error : gachasError}
        onRetry={starterAllowed ? starterGacha.retry : retryGachas}
        coinBalance={wallet.coin}
        diamondBalance={wallet.diamond}
        soundEffectsEnabled={soundEffectsEnabled}
        onBack={goBack}
        // 뽑은 아이템·캐릭터의 재조회는 useGacha가 인벤토리·캐릭터 쿼리를
        // 무효화해 처리한다 (#1027) — 셸이 손으로 꿰던 재조회 두 줄이 사라졌다.
        onDraw={starterAllowed ? starterGacha.draw : drawGachaMachine}
        placeableItemIds={placeableFurnitureIds}
        // 보상 목록 (#620) — 시트가 자체 재시도를 가지므로 실패는 null로.
        onLoadRewards={
          starterAllowed ? undefined : (gachaId) => fetchGachaRewards(gachaId).catch(() => null)
        }
        onGoPlace={goPlaceDrawn}
        // 뽑기 성공 = 미션 2 완료 (#571) — 연출이 끝나고 확인을 누른
        // 순간에. 뽑기 직후 완료시키면 미션 시트가 연출을 덮는다.
        onResultsConfirmed={onFirstDrawConfirmed}
      />
    ) : null;

  return { subScreen };
}
