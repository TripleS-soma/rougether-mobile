import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchHouse } from '@/api/houses';
import { ApiError } from '@/api/http';
import { ErrorCode } from '@/api/error-codes';
import { fetchOnboardingHouse, saveOnboardingHouse } from '@/api/onboarding';
import {
  type OnboardingHouseChoice,
  type OnboardingHouseOutcome,
  OnboardingHouseScreen,
} from '@/components/screens/onboarding-house-screen';
import { useToast } from '@/components/ui/toast';
import { useT } from '@/i18n';
import { track } from '@/lib/analytics';

/**
 * 온보딩 집 선택 게이트 (#1407) — `PUT /onboarding/house`를 보내고 결과 카드를 보여준 뒤
 * `onFinish`로 앱에 들여보낸다. 서버가 이미 선택을 기록했으면(재시작·재설치) 화면 없이 통과.
 * 실패는 토스트 한 번 뒤 통과한다 — 집은 나중에 집 탭에서 언제든 들어갈 수 있다.
 */
export function OnboardingHouseGate({ onFinish }: { onFinish: () => Promise<void> }) {
  const tr = useT();
  const { show: toast } = useToast();
  const [outcome, setOutcome] = useState<OnboardingHouseOutcome | null>(null);
  const [saving, setSaving] = useState(false);
  const closing = useRef(false);
  const finish = useCallback(async () => {
    if (closing.current) return;
    closing.current = true;
    await onFinish();
  }, [onFinish]);

  useEffect(() => {
    let alive = true;
    void fetchOnboardingHouse()
      .then((res) => {
        if (!alive) return;
        if (res.completed) void finish();
        else track('onboarding_house_view');
      })
      .catch(() => {
        if (alive) track('onboarding_house_view');
      });
    return () => {
      alive = false;
    };
  }, [finish]);

  const choose = useCallback(
    async (choice: OnboardingHouseChoice) => {
      if (saving || closing.current) return;
      setSaving(true);
      try {
        const res = await saveOnboardingHouse(choice);
        track('onboarding_house_choice', { choice, result: res.result ?? 'unknown' });
        if (res.result === 'JOINED') {
          let next: OnboardingHouseOutcome = { result: 'JOINED' };
          if (res.houseId != null) {
            // 이름·인원은 카드 장식이라 실패해도 합류 사실은 알린다.
            try {
              const detail = await fetchHouse(res.houseId);
              next = {
                result: 'JOINED',
                houseName: detail.name,
                memberCount: detail.currentMemberCount,
              };
            } catch {
              // 카드에 이름 없이.
            }
          }
          setOutcome(next);
        } else if (res.result === 'NO_MATCH') {
          setOutcome({ result: 'NO_MATCH' });
        } else {
          await finish();
        }
      } catch (err) {
        // 이미 골라둔 계정(다른 기기·재설치)은 서버 기록이 진실 — 조용히 통과.
        const already =
          err instanceof ApiError && err.code === ErrorCode.ONBOARDING_HOUSE_ALREADY_SELECTED;
        if (!already) toast(tr('member.onboardingHouse.failed'), 'error');
        await finish();
      } finally {
        setSaving(false);
      }
    },
    [saving, finish, toast, tr],
  );

  return (
    <OnboardingHouseScreen
      outcome={outcome}
      saving={saving}
      onChoose={(choice) => {
        void choose(choice);
      }}
      onContinue={() => {
        void finish();
      }}
    />
  );
}
