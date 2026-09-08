import { useRef, useState } from 'react';
import { type View } from 'react-native';

import { useToast } from '@/components/ui/toast';
import { saveRoomImage } from '@/lib/room-capture';

/**
 * 방 이미지 갤러리 저장 (#245) — 나의 방 화면에서 뽑아냈다. 캡처 대상 ref와
 * 캡처 중 플래그(#475: view-shot이 보이는 트리를 찍으므로 그동안 떠 있는
 * 버튼을 감춘다)를 소유하고, 결과별 토스트까지 여기서 띄운다. 위젯 캡처
 * (`useWidgetRoomCapture`)가 같은 ref·플래그를 나눠 쓴다.
 */
export function useRoomImageSave() {
  const { show: toast } = useToast();
  // 방 뷰 캡처 대상 (#245) — 갤러리 저장은 네이티브 전용.
  const roomShotRef = useRef<View>(null);
  // 캡처 동안 뽑기 버튼을 숨긴다 (#475) — view-shot이 보이는 트리를 찍으므로,
  // 이 플래그로 버튼을 잠깐 감췄다가 저장 후 되돌린다.
  const [capturing, setCapturing] = useState(false);
  const onSaveRoomImage = async () => {
    setCapturing(true);
    // 상태 반영(버튼 숨김)이 네이티브에 커밋된 뒤 찍히도록 두 프레임 양보.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    const result = await saveRoomImage(roomShotRef).finally(() => setCapturing(false));
    if (result === 'saved') toast('방 이미지를 갤러리에 저장했어요', 'success');
    else if (result === 'denied') toast('사진 접근 권한을 허용해주세요', 'error');
    else if (result === 'unsupported') toast('웹에서는 이미지 저장을 지원하지 않아요', 'error');
    else toast('이미지 저장에 실패했어요', 'error');
  };

  return { roomShotRef, capturing, setCapturing, onSaveRoomImage };
}
