import { useState } from 'react';
import { FurnitureStudioScreen } from '@/components/screens/furniture-studio-screen';
import { useFurnitureStudio } from '@/hooks/use-furniture-studio';

export function FurnitureStudio({
  onBack,
  onGoToRoom,
  onAttendance,
}: {
  onBack: () => void;
  onGoToRoom: () => Promise<boolean>;
  onAttendance?: () => void;
}) {
  const studio = useFurnitureStudio();
  const [placementError, setPlacementError] = useState<string | null>(null);
  return (
    <FurnitureStudioScreen
      {...studio}
      onChoosePhoto={studio.choosePhoto}
      onSubmit={studio.submit}
      onRetry={() => {
        setPlacementError(null);
        void studio.refresh();
      }}
      onBack={onBack}
      error={placementError ?? studio.error}
      onGoToRoom={async () => {
        setPlacementError(null);
        if (!(await onGoToRoom()))
          setPlacementError('가구함을 불러오지 못했어요. 다시 시도해주세요.');
      }}
      onAttendance={onAttendance}
    />
  );
}
