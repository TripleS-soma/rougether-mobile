import type { RoomCell } from '@/components/screens/house/types';

/**
 * 좌석 배치 순수 산술 — house-screen.tsx의 `useMemo` 본문에서 떼어낸 것(리팩토링
 * 4묶음). 화면은 `useMemo` 래퍼를 그대로 두고 여기 함수를 부른다(참조 안정 불변).
 * 창문 슬롯 산식(`houseWindowSeats`)은 이미 resources/house-frame에 있어 그대로 쓴다.
 */

/**
 * 표시 행(어댑터 층 구성)별 좌석 인덱스. 층 라벨 없이 한 그리드로 — 행은
 * 어댑터의 층 구성을 그대로 쓴다. 홀수 정원의 반쪽 행이 위층에 있어서,
 * 평탄화 후 2개씩 다시 끊으면 행이 밀린다.
 *
 * @param rowShapes 층별 방 수 (`floors.map((f) => f.rooms.length)`)
 */
export function seatRowsFor(rowShapes: number[]): number[][] {
  const rows: number[][] = [];
  let seatOffset = 0;
  for (const size of rowShapes) {
    // Defensively split malformed wide rows so no member is dropped.
    for (let start = 0; start < size; start += 2) {
      rows.push(
        Array.from({ length: Math.min(2, size - start) }, (_, i) => seatOffset + start + i),
      );
    }
    seatOffset += size;
  }
  return rows;
}

/**
 * 프레임 창문에 못 들어간 앞쪽 행들 — 평면 그리드로 그린다. 창문은 뒤에서부터
 * `windowCount / 2` 행을 가져가므로(`houseWindowSeats`), 그 앞 행이 그리드 몫.
 *
 * `rowOffsets[i]`는 i번째 그리드 행의 첫 좌석 인덱스 — 드래그 중인 좌석이
 * 어느 행에 있는지 판정하는 데 쓴다.
 */
export function gridRoomPairs(
  seatRows: number[][],
  displayCells: RoomCell[],
  windowCount: number,
): { roomPairs: RoomCell[][]; rowOffsets: number[] } {
  const gridSeatRows = seatRows.slice(0, -windowCount / 2);
  return {
    roomPairs: gridSeatRows.map((row) => row.map((i) => displayCells[i])) as RoomCell[][],
    rowOffsets: gridSeatRows.map((row) => row[0] ?? 0),
  };
}
