import { useState } from 'react';
import { FurnitureStudioScreen } from '@/components/screens/furniture-studio-screen';
import { useFurnitureStudio } from '@/hooks/use-furniture-studio';
import { useT } from '@/i18n';

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
  const tr = useT();
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
          setPlacementError(tr('roomShop.studio.error.inventoryLoadFailed'));
      }}
      onAttendance={onAttendance}
    />
  );
}
