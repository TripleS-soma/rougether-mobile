import { fireEvent, render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HouseScreen, type House } from '@/components/screens/house-screen';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { BrandThemeProvider } from '@/hooks/use-tokens';
import { assetSource } from '@/resources/asset';
import {
  HOUSE_BACKGROUND_KEY_BY_THEME,
  HOUSE_DARK_BACKGROUND_KEY_BY_THEME,
} from '@/resources/house-background';
import { BackgroundModeControl, MISSION_HOUSE } from '@/test-utils/house-screen-fixtures';

jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: jest.fn(() => 'light') }));
beforeEach(() => jest.mocked(useColorScheme).mockReturnValue('light'));

describe('HouseScreen — 배경 테마·다크 모드', () => {
  it.each(['cloud-balloon', 'coral-aquarium', 'mushroom-forest', 'night-observatory'])(
    '%s 기존 프레임에서도 6명과 5·6번째 방 방문을 보존한다',
    async (theme) => {
      const onVisitFriend = jest.fn();
      const rooms = Array.from({ length: 6 }, (_, index) => ({
        name: `구성원${index + 1}`,
        membershipId: 101 + index,
        color: '#F5E1D8',
      }));
      const house: House = {
        ...MISSION_HOUSE,
        maxMembers: 6,
        memberCount: 6,
        coverImageKey: `house/${theme}/house-unified-${theme}-frame${theme === 'night-observatory' ? '-v3' : ''}.png`,
        floors: [0, 1, 2].map((index) => ({
          level: `${index + 1}층`,
          rooms: rooms.slice(index * 2, index * 2 + 2),
        })),
      };
      const ui = await render(<HouseScreen houses={[house]} onVisitFriend={onVisitFriend} />);
      for (const room of rooms) expect(ui.getByText(room.name)).toBeTruthy();
      for (const room of rooms.slice(4)) {
        await fireEvent.press(ui.getByText(room.name));
        expect(onVisitFriend).toHaveBeenLastCalledWith(
          expect.objectContaining({ membershipId: room.membershipId }),
        );
      }
      expect(onVisitFriend).toHaveBeenCalledTimes(2);
    },
  );

  it('시스템 모드는 OS 다크 설정을 따르고 명시적 라이트 선택이 우선한다', async () => {
    await AsyncStorage.clear();
    jest.mocked(useColorScheme).mockReturnValue('dark');
    const ui = await render(
      <BrandThemeProvider>
        <BackgroundModeControl />
        <HouseScreen
          houses={[
            {
              ...MISSION_HOUSE,
              coverImageKey: 'house/cloud-balloon/frame-v27.png',
            },
          ]}
        />
      </BrandThemeProvider>,
    );
    expect(ui.getByTestId('house-background').props.recyclingKey).toBe(
      HOUSE_DARK_BACKGROUND_KEY_BY_THEME['cloud-balloon'],
    );
    await fireEvent.press(ui.getByLabelText('test-light-mode'));
    expect(ui.getByTestId('house-background').props.recyclingKey).toBe(
      HOUSE_BACKGROUND_KEY_BY_THEME['cloud-balloon'],
    );
    await AsyncStorage.clear();
  });

  it('앱 모드 전환과 다크모드 집 이동에 맞춰 배경 source와 캐시 키가 바뀐다', async () => {
    await AsyncStorage.clear();
    const houses = ['cloud-balloon', 'coral-aquarium', 'mushroom-forest', 'night-observatory'].map(
      (theme, index) => ({
        ...MISSION_HOUSE,
        houseId: index + 10,
        coverImageKey: `house/${theme}/frame-v27.png`,
      }),
    );
    const ui = await render(
      <BrandThemeProvider>
        <BackgroundModeControl />
        <HouseScreen houses={houses} />
      </BrandThemeProvider>,
    );
    await fireEvent.press(ui.getByLabelText('test-dark-mode'));
    for (const [index, theme] of [
      'cloud-balloon',
      'coral-aquarium',
      'mushroom-forest',
      'night-observatory',
    ].entries()) {
      if (index > 0) await fireEvent.press(ui.getByLabelText('다음 집'));
      const key =
        theme === 'night-observatory'
          ? 'house/night-observatory/backgrounds/house-night-observatory-background-dark-v1.webp'
          : HOUSE_DARK_BACKGROUND_KEY_BY_THEME[
              theme as keyof typeof HOUSE_DARK_BACKGROUND_KEY_BY_THEME
            ];
      expect(ui.getByTestId('house-background').props).toMatchObject({
        source: [assetSource(key)],
        recyclingKey: key,
      });
    }
    await fireEvent.press(ui.getByLabelText('test-light-mode'));
    expect(ui.getByTestId('house-background').props.recyclingKey).toBe(
      'house/night-observatory/backgrounds/house-night-observatory-background-v1.webp',
    );
    await AsyncStorage.clear();
  });

  it('알 수 없는 테마는 다크모드에서도 배경 이미지 대신 하늘 폴백을 유지한다', async () => {
    await AsyncStorage.clear();
    const ui = await render(
      <BrandThemeProvider>
        <BackgroundModeControl />
        <HouseScreen houses={[{ ...MISSION_HOUSE, coverImageKey: 'house/unknown/frame.png' }]} />
      </BrandThemeProvider>,
    );
    await fireEvent.press(ui.getByLabelText('test-dark-mode'));
    expect(ui.queryByTestId('house-background')).toBeNull();
    expect(ui.getByTestId('house-background-layer')).toBeTruthy();
    await AsyncStorage.clear();
  });

  it('선택한 집의 커버 테마를 전면 배경에도 즉시 적용한다', async () => {
    const cloudHouse = {
      ...MISSION_HOUSE,
      name: '구름 집',
      coverImageKey: 'house/cloud-balloon/house-unified-cloud-balloon-frame.png',
    };
    const mushroomHouse = {
      ...MISSION_HOUSE,
      houseId: 8,
      name: '버섯 집',
      coverImageKey: 'house/mushroom-forest/house-unified-mushroom-forest-frame.png',
    };
    const ui = await render(<HouseScreen houses={[cloudHouse, mushroomHouse]} />);

    expect(ui.getByTestId('house-background').props).toMatchObject({
      recyclingKey: HOUSE_BACKGROUND_KEY_BY_THEME['cloud-balloon'],
      contentFit: 'cover',
      cachePolicy: 'memory-disk',
    });
    await fireEvent.press(ui.getByLabelText('다음 집'));
    expect(ui.getByTestId('house-background').props.recyclingKey).toBe(
      HOUSE_BACKGROUND_KEY_BY_THEME['mushroom-forest'],
    );
  });

  // 헤더바 제거(#986)로 `streakDays`·`coinBalance`·`diamondBalance` prop 자체가
  // 사라졌다 — 넘길 수 없으니 "안 보인다"를 런타임에서 단언할 수 없고, 타입이
  // 컴파일 단계에서 막는다. 무의미해질 테스트를 두는 대신 여기 근거만 남긴다.
});
