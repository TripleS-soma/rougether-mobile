import { type Dispatch, type RefObject, type SetStateAction, useEffect, useRef } from 'react';
import { Platform, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { refreshWidgets } from '@/widgets/rougether-widgets';
import { saveWidgetRoomImage } from '@/widgets/widget-data';

/**
 * 홈 위젯용 무음 방 캡처 (#604, 안드로이드 전용) — 방 구성이 바뀌었을 때만
 * 잠깐 뽑기 버튼을 숨기고(기존 #475 플래그 재사용) data URI로 찍어 위젯
 * 저장소에 넘긴다. 시그니처 비교로 같은 방은 다시 찍지 않는다.
 */
export function useWidgetRoomCapture({
  shotRef,
  signature,
  loading,
  capturing,
  setCapturing,
}: {
  /** The room view to capture (same ref as the 방 이미지 저장 shot, #245). */
  shotRef: RefObject<View | null>;
  /** Room composition signature — a change triggers a (re)capture. */
  signature: string;
  loading: boolean;
  /** 캡처 중 뽑기 버튼 숨김 플래그 (#475) — 화면이 소유하고 여기서 재사용. */
  capturing: boolean;
  setCapturing: Dispatch<SetStateAction<boolean>>;
}) {
  const widgetShotSigRef = useRef('');
  useEffect(() => {
    // 홈 위젯이 있는 플랫폼만 (#604 안드, #606 iOS) — 웹은 캡처 제외.
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
    if (widgetShotSigRef.current === signature) return;
    // 로딩 중이거나 다른 캡처가 진행 중이면 다음 변화 때 다시 시도된다.
    if (loading || capturing) return;
    const timer = setTimeout(async () => {
      widgetShotSigRef.current = signature;
      setCapturing(true);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      try {
        const dataUri = await captureRef(shotRef, {
          format: 'png',
          quality: 0.9,
          result: 'data-uri',
          width: 512,
          height: 512,
        });
        await saveWidgetRoomImage(dataUri);
        refreshWidgets();
      } catch {
        // 위젯은 부가 표면 — 실패 시 다음 방 변화 때 다시 찍는다.
        widgetShotSigRef.current = '';
      } finally {
        setCapturing(false);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [signature, loading, capturing, shotRef, setCapturing]);
}
