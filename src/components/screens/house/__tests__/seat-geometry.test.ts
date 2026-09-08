import { gridRoomPairs, seatRowsFor } from '@/components/screens/house/seat-geometry';
import type { RoomCell } from '@/components/screens/house/types';
import { houseWindowSeats } from '@/resources/house-frame';

const cell = (name: string, vacant = false): RoomCell => ({ name, color: '#EEE', vacant });

// 어댑터가 만드는 층 구성 — 정원 2/4/6은 2인 행, 홀수 정원은 반쪽 행이 위층(앞)에.
const shapes = { 2: [2], 3: [1, 2], 4: [2, 2], 6: [2, 2, 2] };

describe('seatRowsFor', () => {
  it('정원 2/4/6 — 층마다 좌석 2개씩 이어지는 인덱스', () => {
    expect(seatRowsFor(shapes[2])).toEqual([[0, 1]]);
    expect(seatRowsFor(shapes[4])).toEqual([
      [0, 1],
      [2, 3],
    ]);
    expect(seatRowsFor(shapes[6])).toEqual([
      [0, 1],
      [2, 3],
      [4, 5],
    ]);
  });

  it('홀수 정원 — 위층 반쪽 행이 그대로 남는다 (평탄화 후 2개씩 끊으면 밀린다)', () => {
    expect(seatRowsFor(shapes[3])).toEqual([[0], [1, 2]]);
  });

  it('잘못 넓은 행은 2개씩 쪼개 아무도 빠지지 않는다', () => {
    expect(seatRowsFor([3, 2])).toEqual([[0, 1], [2], [3, 4]]);
  });

  it('층이 없으면 빈 행', () => {
    expect(seatRowsFor([])).toEqual([]);
  });
});

describe('gridRoomPairs', () => {
  const cells4 = [cell('나'), cell('친구'), cell('빈방', true), cell('빈방', true)];

  it('창문이 모든 행을 가져가면 평면 그리드는 비어 있다 (정원 4, 창문 4)', () => {
    const rows = seatRowsFor(shapes[4]);
    expect(gridRoomPairs(rows, cells4, 4)).toEqual({ roomPairs: [], rowOffsets: [] });
    // 창문 슬롯(위→아래)은 행 순서를 지킨다 — 첫 행이 맨 위 창문.
    expect(houseWindowSeats(rows, 4)).toEqual([0, 1, 2, 3]);
  });

  it('창문보다 행이 많으면 앞 행이 그리드로 남는다 (정원 6, 레거시 창문 4)', () => {
    const cells6 = [...cells4, cell('빈방', true), cell('빈방', true)];
    const rows = seatRowsFor(shapes[6]);
    const { roomPairs, rowOffsets } = gridRoomPairs(rows, cells6, 4);
    expect(roomPairs).toEqual([[cells6[0], cells6[1]]]);
    expect(rowOffsets).toEqual([0]);
    // 뒤의 두 행만 창문으로 — 앞 행(그리드)과 겹치지 않는다.
    expect(houseWindowSeats(rows, 4)).toEqual([2, 3, 4, 5]);
  });

  it('홀수 정원 — 반쪽 행이 그리드에 남고 빈 좌석 셀도 자리를 지킨다 (정원 3, 창문 2)', () => {
    const cells3 = [cell('나'), cell('친구'), cell('빈방', true)];
    const { roomPairs, rowOffsets } = gridRoomPairs(seatRowsFor(shapes[3]), cells3, 2);
    expect(roomPairs).toEqual([[cells3[0]]]);
    expect(rowOffsets).toEqual([0]);
  });

  it('rowOffsets는 각 그리드 행의 첫 좌석 인덱스', () => {
    const rows = seatRowsFor([2, 2, 2]);
    expect(gridRoomPairs(rows, [], 2).rowOffsets).toEqual([0, 2]);
  });
});
