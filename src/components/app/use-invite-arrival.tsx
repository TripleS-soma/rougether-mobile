import { useCallback, useEffect, useRef, useState } from 'react';

import type { InvitePreview } from '@/components/screens/invite-friends-screen';
import { InviteArrivalSheet } from '@/components/screens/sheets/invite-arrival-sheet';
import { InvitePasteSheet } from '@/components/screens/sheets/invite-paste-sheet';
import { useToast } from '@/components/ui/toast';
import type { InviteCheck, InviteVia, RedeemResult } from '@/hooks/use-invites';
import { useLatestRef } from '@/hooks/use-stable-value';
import { track } from '@/lib/analytics';
import { parseInviteText } from '@/lib/invite-code';
import {
  clearPendingFriendInviteCode,
  hydratePendingInvites,
  peekPendingFriendInviteCode,
  peekPendingInviteCode,
  setPendingFriendInviteCode,
  setPendingInviteCode,
  subscribePendingFriendInviteCode,
} from '@/lib/pending-invite';

export type UseInviteArrivalArgs = {
  /** 첫 온보딩 직후 마운트 — '친구에게 초대받아 오셨나요?'를 1회 묻는다. */
  offerPaste: boolean;
  /**
   * 사용 전 판정 — 쓸 수 없는 코드(`invalid`)와 일시적 실패(`unavailable`)를 가른다.
   * 일시적 실패면 기기에 보관한 코드를 지우지 않는다(다음 실행에 다시 확인).
   */
  check: (code: string) => Promise<InviteCheck>;
  /** 실제 사용 — 확인 시트의 [받기]에서만 부른다. */
  redeem: (code: string, via: InviteVia) => Promise<RedeemResult | null>;
  /** [나중에] — 코드를 친구 초대 화면 입력란에 남긴다. */
  onLater?: (code: string) => void;
};

/**
 * 친구 초대로 들어온 사람 받기 (#1007) — 셸이 마운트된 뒤(로그인·온보딩·추천 루틴
 * 게이트를 모두 지난 뒤)에만 돈다.
 *
 * 1. 기기에 남은 코드를 되살린다 — 링크를 열고 설치·로그인하는 사이 앱을 껐어도.
 * 2. 첫 온보딩 직후면 붙여넣기 시트를 1회 띄운다 — 링크로 이미 코드가 왔으면 묻지 않는다.
 * 3. 친구 코드가 들어오면(링크·붙여넣기) 미리보기 → 확인 시트. 이미 보상을 받은
 *    계정이거나 쓸 수 없는 코드면 시트 없이 끝낸다. **[받기] 전에는 redeem하지 않는다.**
 *    네트워크·서버 일시 오류면 코드를 지우지 않는다 — 기기 보관분이 다음 실행에 다시 온다.
 *
 * 집 코드는 기존 집 탐색 흐름(`use-house-pages`의 구독)이 받는다 — 붙여넣기에서
 * 집 코드가 나오면 그 채널로 넘기기만 한다.
 */
export function useInviteArrival({ offerPaste, check, redeem, onLater }: UseInviteArrivalArgs) {
  const { show: toast } = useToast();
  const [arrival, setArrival] = useState<{ preview: InvitePreview; via: InviteVia } | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const checkRef = useLatestRef(check);
  const redeemRef = useLatestRef(redeem);
  const onLaterRef = useLatestRef(onLater);
  // 확인 중이거나 시트에 떠 있는 코드 — 같은 코드가 다시 흘러와도(재구독·복원) 한 번만.
  const handlingRef = useRef<string | null>(null);
  // 붙여넣기로 넣은 코드면 계측 via를 paste로.
  const pastedRef = useRef<string | null>(null);
  const offeredRef = useRef(false);

  useEffect(
    () =>
      subscribePendingFriendInviteCode((code) => {
        if (handlingRef.current === code) return;
        handlingRef.current = code;
        const via: InviteVia = pastedRef.current === code ? 'paste' : 'link';
        void checkRef.current(code).then((result) => {
          if (result.kind === 'unavailable') {
            // 네트워크·서버 일시 오류 — 코드를 지우지 않고 조용히 둔다. 기기 보관분이
            // 다음 실행의 복원에서 다시 확인된다. 같은 코드가 다시 흘러오면 재시도.
            // 붙여넣기 표시(pastedRef)는 남긴다 — 재시도하는 건 여전히 붙여넣은 코드다.
            handlingRef.current = null;
            return;
          }
          if (result.kind === 'invalid' || result.preview.alreadyRedeemed) {
            // 쓸 수 없는 코드는 이유를 알리고, 이미 받은 계정은 조용히 끝낸다.
            if (result.kind === 'invalid') toast(result.message, 'error');
            clearPendingFriendInviteCode();
            handlingRef.current = null;
            // 끝난 코드다 — 같은 문자열이 나중에 링크로 오면 via는 link여야 한다.
            if (pastedRef.current === code) pastedRef.current = null;
            return;
          }
          track('invite_arrival_view', { via });
          setArrival({ preview: result.preview, via });
        });
      }),
    [checkRef, toast],
  );

  // 기기에 남은 코드 복원 — 구독 뒤에 해야 복원분이 곧장 흐른다.
  useEffect(() => {
    void hydratePendingInvites();
  }, []);

  useEffect(() => {
    if (!offerPaste || offeredRef.current) return;
    offeredRef.current = true;
    void hydratePendingInvites().then(() => {
      // 링크로 이미 코드가 왔으면 붙여넣기를 묻지 않는다.
      if (peekPendingFriendInviteCode() || peekPendingInviteCode()) return;
      track('invite_paste_view');
      setPasteOpen(true);
    });
  }, [offerPaste]);

  const finish = useCallback(() => {
    clearPendingFriendInviteCode();
    handlingRef.current = null;
    pastedRef.current = null;
    setArrival(null);
  }, []);

  const accept = useCallback(async () => {
    if (!arrival || accepting) return;
    setAccepting(true);
    const result = await redeemRef.current(arrival.preview.code, arrival.via);
    setAccepting(false);
    // 실패(이미 사용·무효)는 redeem이 안내했다 — 같은 코드로 다시 묻지 않는다.
    finish();
    if (result) toast(`코인 ${result.rewardCoin}개를 받았어요`, 'success');
  }, [arrival, accepting, redeemRef, finish, toast]);

  const later = useCallback(() => {
    if (!arrival || accepting) return;
    track('invite_arrival_later');
    onLaterRef.current?.(arrival.preview.code);
    finish();
  }, [arrival, accepting, onLaterRef, finish]);

  const paste = useCallback((text: string) => {
    const parsed = parseInviteText(text);
    if (!parsed) {
      track('invite_paste_result', { kind: 'invalid' });
      setPasteError('초대코드를 찾지 못했어요. 초대 페이지에서 코드를 다시 복사해 주세요.');
      return;
    }
    track('invite_paste_result', { kind: parsed.kind });
    setPasteError(null);
    setPasteOpen(false);
    if (parsed.kind === 'friend') {
      pastedRef.current = parsed.code;
      setPendingFriendInviteCode(parsed.code);
    } else {
      setPendingInviteCode(parsed.code);
    }
  }, []);

  const dismissPaste = useCallback(() => {
    track('invite_paste_result', { kind: 'dismiss' });
    setPasteError(null);
    setPasteOpen(false);
  }, []);

  const sheets = (
    <>
      <InvitePasteSheet
        visible={pasteOpen}
        onPaste={paste}
        onDismiss={dismissPaste}
        error={pasteError}
      />
      <InviteArrivalSheet
        visible={arrival != null}
        preview={arrival?.preview ?? null}
        busy={accepting}
        onAccept={() => void accept()}
        onLater={later}
      />
    </>
  );

  return { sheets };
}
