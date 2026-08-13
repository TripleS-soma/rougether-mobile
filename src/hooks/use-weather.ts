/**
 * 현재 비 여부 (#360) — Open-Meteo(무료·키 불필요)를 서울 고정 좌표로 조회.
 * 기기 위치 권한 없이 동작하는 대신 국내 사용자 기준 근사치다. 마운트 시
 * 1회 + 30분 캐시(모듈 스코프 — 화면 재마운트에도 재요청하지 않음), 조회
 * 실패는 조용히 맑음 취급.
 */
import { useEffect, useState } from 'react';

const SEOUL = { latitude: 37.5665, longitude: 126.978 };
const CACHE_MS = 30 * 60 * 1000;

/** WMO 날씨 코드 중 비로 취급하는 것 — 이슬비/비 51–67, 소나기 80–82, 뇌우 95–99. */
export function isRainCode(code: number): boolean {
  return (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99);
}

let cached: { raining: boolean; at: number } | null = null;

async function fetchRaining(): Promise<boolean> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${SEOUL.latitude}` +
    `&longitude=${SEOUL.longitude}&current=weather_code,precipitation`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`weather ${res.status}`);
  const body = (await res.json()) as {
    current?: { weather_code?: number; precipitation?: number };
  };
  const code = body.current?.weather_code;
  const precip = body.current?.precipitation ?? 0;
  return (code != null && isRainCode(code)) || precip > 0;
}

export function useWeather(): { raining: boolean } {
  const [raining, setRaining] = useState(() =>
    cached && Date.now() - cached.at < CACHE_MS ? cached.raining : false,
  );

  useEffect(() => {
    if (cached && Date.now() - cached.at < CACHE_MS) return;
    let active = true;
    fetchRaining()
      .then((r) => {
        cached = { raining: r, at: Date.now() };
        if (active) setRaining(r);
      })
      .catch(() => {
        // 실패는 맑음 취급 — 재시도는 다음 마운트(캐시 미저장)에 맡긴다.
      });
    return () => {
      active = false;
    };
  }, []);

  return { raining };
}
