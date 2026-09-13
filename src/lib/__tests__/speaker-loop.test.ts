import { crossfadeLoop } from '@/lib/speaker-loop';
it('끝과 시작을 겹치고 중간 PCM을 보존하여 파일 재시작 경계를 없앤다', () => {
  const input = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const output = crossfadeLoop(input, 3);
  expect(Array.from(output)).toEqual([7, 5, 3, 4, 5, 6]);
  expect(Array.from(input)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
});
it('상수 신호는 이음새에서 볼륨이 튀거나 사라지지 않는다', () => {
  const output = crossfadeLoop(new Float32Array(100).fill(0.5), 20);
  expect(output.length).toBe(80);
  expect(Array.from(output).every((value) => value === 0.5)).toBe(true);
});
