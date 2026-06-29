import { useState } from 'react';

import { AddRoutineScreen } from '@/components/screens/add-routine-screen';
import { MyRoomScreen } from '@/components/screens/my-room-screen';
import { RoomDecorScreen } from '@/components/screens/room-decor-screen';
import { type NewRoutine, type Routine, SAMPLE_ROUTINES } from '@/constants/routines';
import { DEFAULT_PLACED_FURNITURE_IDS, DEFAULT_WALLPAPER_ID } from '@/resources/furniture';

type Screen = 'myRoom' | 'decor' | 'addRoutine';

/**
 * Minimal "real app" entry for the 나의 방 cluster: holds routine + room state
 * and switches between the room view, room decoration, and add-routine screens.
 * This is the wiring layer the pure screens were built for (data + callbacks).
 */
export function MyRoomApp() {
  const [screen, setScreen] = useState<Screen>('myRoom');
  const [routines, setRoutines] = useState<Routine[]>(SAMPLE_ROUTINES);
  const [placedFurnitureIds, setPlacedFurnitureIds] = useState<string[]>(
    DEFAULT_PLACED_FURNITURE_IDS,
  );
  const [wallpaperId, setWallpaperId] = useState(DEFAULT_WALLPAPER_ID);

  const toggleRoutine = (id: string) =>
    setRoutines((prev) => prev.map((r) => (r.id === id ? { ...r, completed: !r.completed } : r)));

  const addRoutine = (n: NewRoutine) =>
    setRoutines((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        title: n.title,
        emoji: n.emoji,
        category: n.category,
        completed: false,
        days: n.days,
        startDate: n.startDate,
        endDate: n.endDate,
        alarmEnabled: n.alarmEnabled,
        time: n.time,
        photoVerify: n.photoVerify,
      },
    ]);

  if (screen === 'decor') {
    return (
      <RoomDecorScreen
        initialPlacedIds={placedFurnitureIds}
        initialWallpaperId={wallpaperId}
        onApply={(ids, wp) => {
          setPlacedFurnitureIds(ids);
          setWallpaperId(wp);
        }}
        onBack={() => setScreen('myRoom')}
      />
    );
  }

  if (screen === 'addRoutine') {
    return <AddRoutineScreen onAdd={addRoutine} onBack={() => setScreen('myRoom')} />;
  }

  return (
    <MyRoomScreen
      routines={routines}
      placedFurnitureIds={placedFurnitureIds}
      wallpaperId={wallpaperId}
      onToggleRoutine={toggleRoutine}
      onEdit={() => setScreen('decor')}
      onAddRoutine={() => setScreen('addRoutine')}
    />
  );
}
