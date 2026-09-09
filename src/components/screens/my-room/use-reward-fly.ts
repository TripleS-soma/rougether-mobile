import { useEffect, useRef, useState } from 'react';
import { Animated, type View } from 'react-native';

import { useAnimatedValue } from '@/hooks/use-stable-value';
import { NATIVE_DRIVER } from '@/utils/animation';

/** 보상 알약이 떠 있는 시간 — 코인 플라이(~600ms)가 도착하고 읽을 만큼. */
const REWARD_PILL_MS = 2200;

/** 코인이 출발하는 탭 지점 (window 좌표). */
export type FlyOrigin = { x: number; y: number };

/** 오버레이에 그릴 코인 하나 — 좌표는 화면 루트 기준. */
export type FlyingCoinSpec = { id: number; x: number; y: number; tx: number; ty: number };

/**
 * 완료 보상 연출 (#440 → #1055) — 보상 알약·코인 플라이·스트릭 펄스.
 * 나의 방 화면에서 뽑아낸 상태/애니메이션 묶음이라 반환값은 그 화면의 렌더가
 * 읽는 것 그대로다: 루트/알약 ref, 알약·스트릭 펄스 값, 날고 있는 코인 목록,
 * 표시 중인 보상, 그리고 보상을 띄우는 `showReward`.
 */
export function useRewardFly(streakDays: number) {
  // 코인 플라이 (#440) — 완료 탭 지점에서 보상 알약(#1055)으로 포물선 비행.
  const rootRef = useRef<View>(null);
  const rewardPillRef = useRef<View>(null);
  const flyTarget = useRef({ x: 0, y: 0 });
  const rewardPulse = useAnimatedValue(1);
  const coinSeq = useRef(0);
  const [flyingCoins, setFlyingCoins] = useState<FlyingCoinSpec[]>([]);
  // 보상 알약 (#1055) — 스트릭·코인은 상시 헤더가 아니라 보상이 확인된 순간에만
  // 방 위에 떠서 증분을 보여주고 REWARD_PILL_MS 뒤 사라진다. 표시 중 또 오면 합산.
  const [reward, setReward] = useState<{ coins: number } | null>(null);
  const rewardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 알약이 아직 안 떠 있을 때 도착한 보상 — 알약이 그려져 위치가 측정되면 그때 쏜다.
  const pendingFly = useRef<FlyOrigin | null>(null);
  useEffect(
    () => () => {
      if (rewardTimer.current) clearTimeout(rewardTimer.current);
    },
    [],
  );
  const launchCoinAt = ({ x: pageX, y: pageY }: FlyOrigin) => {
    rootRef.current?.measureInWindow((rx, ry) => {
      const target = flyTarget.current;
      if (!target.x && !target.y) return;
      const id = coinSeq.current++;
      setFlyingCoins((prev) => [
        ...prev,
        { id, x: pageX - rx, y: pageY - ry, tx: target.x - rx, ty: target.y - ry },
      ]);
    });
  };
  const showReward = (coins: number, from: FlyOrigin | null) => {
    setReward((prev) => ({ coins: (prev?.coins ?? 0) + coins }));
    if (rewardTimer.current) clearTimeout(rewardTimer.current);
    rewardTimer.current = setTimeout(() => {
      setReward(null);
      flyTarget.current = { x: 0, y: 0 };
    }, REWARD_PILL_MS);
    if (!from) return;
    if (flyTarget.current.x || flyTarget.current.y) launchCoinAt(from);
    else pendingFly.current = from;
  };
  const measureRewardPill = () => {
    rewardPillRef.current?.measureInWindow((x, y, w, h) => {
      flyTarget.current = { x: x + w / 2, y: y + h / 2 };
      const from = pendingFly.current;
      if (from) {
        pendingFly.current = null;
        launchCoinAt(from);
      }
    });
  };

  const onCoinArrive = (id: number) => {
    setFlyingCoins((prev) => prev.filter((c) => c.id !== id));
    rewardPulse.setValue(1.18);
    Animated.spring(rewardPulse, {
      toValue: 1,
      friction: 3.5,
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  };

  // 스트릭 펄스 (#440) — 수치가 오르는 순간 🔥가 한 번 크게 일렁.
  const streakPulse = useAnimatedValue(1);
  const prevStreak = useRef(streakDays);
  useEffect(() => {
    if (streakDays > prevStreak.current) {
      streakPulse.setValue(1.5);
      Animated.spring(streakPulse, {
        toValue: 1,
        friction: 3,
        useNativeDriver: NATIVE_DRIVER,
      }).start();
    }
    prevStreak.current = streakDays;
  }, [streakDays, streakPulse]);

  return {
    rootRef,
    rewardPillRef,
    rewardPulse,
    streakPulse,
    flyingCoins,
    reward,
    showReward,
    measureRewardPill,
    onCoinArrive,
  };
}
