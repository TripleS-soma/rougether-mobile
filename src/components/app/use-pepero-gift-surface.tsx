import { useCallback, useEffect, useRef, useState } from 'react';

import { getSessionUserId } from '@/api';
import { type LoginGift } from '@/api/login-gifts';
import { PeperoGiftPopup } from '@/components/screens/events/pepero-gift-popup';
import { usePeperoGift } from '@/hooks/use-pepero-gift';
import { registerPriorityModal } from '@/lib/modal-presence';

export function usePeperoGiftSurface({
  home,
  ready,
  blocked,
  onGoDecor,
}: {
  home: boolean;
  ready: boolean;
  blocked: boolean;
  onGoDecor: () => void;
}) {
  const userId = getSessionUserId();
  const giftState = usePeperoGift({ enabled: home && ready });
  const [active, setActive] = useState<{ userId: number; gift: LoginGift } | null>(null);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState(false);
  const activeRef = useRef(active);
  activeRef.current = active;
  const shown = useRef(new Set<string>());
  const navigateAfterClose = useRef(false);
  const closing = useRef(false);
  const latest = useRef(giftState);
  latest.current = giftState;
  const gift = giftState.gift;
  const unseen =
    !!gift && !gift.acknowledgedAt && !shown.current.has(`${userId}:${gift.participationId}`);
  const blocking =
    active != null || (home && ready && giftState.inWindow && (giftState.loading || unseen));

  useEffect(() => {
    setActive(null);
    setVisible(false);
    setError(false);
    navigateAfterClose.current = false;
    closing.current = false;
  }, [userId]);
  useEffect(() => {
    if (active) return registerPriorityModal();
  }, [active]);
  useEffect(() => {
    if (!giftState.inWindow) {
      navigateAfterClose.current = false;
      setVisible(false);
    }
  }, [giftState.inWindow]);
  useEffect(() => {
    if (!home || !ready || blocked || active || !unseen || !gift || userId == null) return;
    shown.current.add(`${userId}:${gift.participationId}`);
    setActive({ userId, gift });
    setError(false);
    setVisible(true);
  }, [home, ready, blocked, active, unseen, gift, userId]);

  const close = useCallback(
    async (hideToday: boolean, goDecor = false) => {
      if (!active || closing.current || getSessionUserId() !== active.userId) return;
      closing.current = true;
      setError(false);
      const saved = !hideToday || (await latest.current.acknowledge());
      closing.current = false;
      if (getSessionUserId() !== active.userId) return;
      if (!saved) {
        setError(true);
        return;
      }
      navigateAfterClose.current = goDecor;
      setVisible(false);
    },
    [active],
  );
  const dismissed = useCallback(() => {
    if (!active || activeRef.current !== active || visible || getSessionUserId() !== active.userId)
      return;
    const navigate = navigateAfterClose.current && getSessionUserId() === active.userId;
    activeRef.current = null;
    navigateAfterClose.current = false;
    setActive(null);
    if (navigate) onGoDecor();
  }, [active, visible, onGoDecor]);
  const overlay =
    active && active.userId === userId ? (
      <PeperoGiftPopup
        visible={visible && giftState.inWindow}
        dismissing={giftState.dismissing}
        error={error}
        onClose={(hide) => {
          void close(hide);
        }}
        onGoDecor={(hide) => {
          void close(hide, true);
        }}
        onDismissed={dismissed}
      />
    ) : null;
  return { blocking, overlay };
}
