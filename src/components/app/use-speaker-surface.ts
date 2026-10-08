import { useCallback, useEffect, useState } from 'react';

import type { Screen } from '@/components/app/navigation';
import { useToast } from '@/components/ui/toast';
import { useRoomSpeaker } from '@/hooks/use-room-speaker';
import { useStableCallback } from '@/hooks/use-stable-value';
import type { PlacedFurniture } from '@/resources/furniture';
import { isSpeakerFurniture } from '@/resources/speaker';

/**
 * 방 스피커 서피스 (#1325) — 앱 셸에서 옮겼다(리팩토링 장부 5번, 동작 그대로). 스피커가
 * 방에 놓여 있을 때만 플레이어를 두고, 탭=재생/정지·길게=설정 시트, 소리 설정의 음악이
 * 꺼지면 멈춘다. 나의 방을 떠나거나 스피커를 치우면 시트를 닫는다.
 */
export function useSpeakerSurface({
  screen,
  placedItems,
  catalogue,
  musicEnabled,
  enableSpeakerMusic,
}: {
  screen: Screen;
  placedItems: PlacedFurniture[];
  catalogue: { furniture: { id: string; assetKey: string }[] };
  musicEnabled: boolean;
  enableSpeakerMusic: () => void;
}) {
  const [speakerOpen, setSpeakerOpen] = useState(false);
  const speakerPlaced = placedItems.some((placement) =>
    catalogue.furniture.some(
      (item) => item.id === placement.furnitureId && isSpeakerFurniture(item),
    ),
  );
  const speaker = useRoomSpeaker(speakerPlaced);
  const { show: showSpeakerError } = useToast();
  useEffect(() => {
    if (speaker.error) showSpeakerError(speaker.error);
  }, [speaker.error, showSpeakerError]);
  const playSpeaker = useStableCallback(() => {
    enableSpeakerMusic();
    speaker.play();
  });
  const stopSpeaker = speaker.stop;
  useEffect(() => {
    if (!musicEnabled) stopSpeaker();
  }, [musicEnabled, stopSpeaker]);
  const toggleSpeaker = useStableCallback(() => {
    if (speaker.playing || speaker.loading) speaker.stop();
    else playSpeaker();
  });
  const openSpeaker = useCallback(() => setSpeakerOpen(true), []);
  const closeSpeaker = useCallback(() => setSpeakerOpen(false), []);
  useEffect(() => {
    if (screen !== 'myRoom' || !speakerPlaced) setSpeakerOpen(false);
  }, [screen, speakerPlaced]);
  return { speaker, speakerOpen, playSpeaker, toggleSpeaker, openSpeaker, closeSpeaker };
}
