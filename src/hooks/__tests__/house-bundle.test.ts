import * as auth from '@/api/auth';
import { fetchHouseBundle } from '@/hooks/house-bundle';
import { type FetchLikeResponse, jsonRes as res } from '@/test-utils/fetch';

/**
 * 한 집의 상세 묶음 (#534) — 상세·멤버·미션·입주신청 네 요청을 병렬로 받아 House로 합친다.
 * 미션·신청은 부가 정보라 실패해도 집은 떠야 하고(신청은 비방장이면 403), 상세·멤버
 * 실패는 그대로 던져야 한다.
 */
const HOUSE = 7;
const ME = 4;

type Routes = Partial<
  Record<'detail' | 'members' | 'missions' | 'joinRequests', FetchLikeResponse>
>;

const realFetch = global.fetch;
let requested: string[];

function serve(routes: Routes) {
  requested = [];
  global.fetch = jest.fn(async (url: string) => {
    const path = String(url).split('?')[0];
    requested.push(path);
    if (path.endsWith(`/houses/${HOUSE}`)) return routes.detail ?? res({});
    if (path.endsWith(`/houses/${HOUSE}/members`)) return routes.members ?? res({ items: [] });
    if (path.endsWith(`/houses/${HOUSE}/missions`)) return routes.missions ?? res({ items: [] });
    if (path.endsWith(`/houses/${HOUSE}/join-requests`))
      return routes.joinRequests ?? res({ items: [] });
    return res({ code: 'UNEXPECTED' }, 404);
  }) as unknown as typeof fetch;
}

const DETAIL = {
  houseId: HOUSE,
  name: '우리집',
  maxMembers: 4,
  currentMemberCount: 2,
  myRole: 'OWNER',
  level: 3,
};
const MEMBERS = {
  items: [
    { membershipId: 1, userId: 9, nickname: '이웃', role: 'OWNER', status: 'ACTIVE' },
    { membershipId: 2, userId: ME, nickname: '옛 닉네임', role: 'MEMBER', status: 'ACTIVE' },
    { membershipId: 3, userId: 10, nickname: '떠난이', role: 'MEMBER', status: 'LEFT' },
  ],
};

beforeEach(() => {
  jest.spyOn(auth, 'getSessionUserId').mockReturnValue(ME);
});
afterEach(() => {
  global.fetch = realFetch;
  jest.restoreAllMocks();
});

describe('fetchHouseBundle', () => {
  it('네 요청을 모두 보내고 House 하나로 합친다', async () => {
    serve({
      detail: res(DETAIL),
      members: res(MEMBERS),
      missions: res({
        items: [
          {
            missionId: 50,
            title: '다 같이 출석',
            missionType: 'WEEKLY_MEMBER_COUNT',
            targetValue: 10,
            currentValue: 10,
            status: 'ACTIVE',
          },
        ],
      }),
      joinRequests: res({
        items: [
          { requestId: 70, userId: 33, nickname: '신청자', status: 'PENDING' },
          { requestId: 71, userId: 34, nickname: '처리됨', status: 'ACCEPTED' },
        ],
      }),
    });

    const house = await fetchHouseBundle(HOUSE, '새 닉네임');

    expect(requested.sort()).toEqual(
      [
        `/houses/${HOUSE}`,
        `/houses/${HOUSE}/join-requests`,
        `/houses/${HOUSE}/members`,
        `/houses/${HOUSE}/missions`,
      ]
        .map((p) => expect.stringMatching(new RegExp(`${p}$`)))
        .sort(),
    );
    expect(house).toMatchObject({ houseId: HOUSE, name: '우리집', myRole: 'OWNER', level: 3 });

    // 내 좌석이 1층 왼쪽(첫 칸), 이름은 프로필 닉네임이 우선(#924), 떠난 멤버는 빠지고 정원까지 빈방.
    const seats = [...house.floors].reverse().flatMap((f) => f.rooms);
    expect(seats.map((c) => c.name)).toEqual(['새 닉네임', '이웃', '빈방', '빈방']);
    expect(seats[0]).toMatchObject({ isMine: true, userId: ME });
    expect(seats[1]).toMatchObject({ isMine: false, isOwner: true });

    expect(house.missions).toEqual([
      expect.objectContaining({
        id: 50,
        title: '다 같이 출석',
        current: 10,
        target: 10,
        achieved: true,
      }),
    ]);
    expect(house.joinRequests).toEqual([
      expect.objectContaining({ requestId: 70, nickname: '신청자' }),
    ]);
  });

  it('미션·입주신청이 실패해도(비방장 403 등) 집은 뜨고 둘은 빈 목록', async () => {
    serve({
      detail: res({ ...DETAIL, myRole: 'MEMBER' }),
      members: res(MEMBERS),
      missions: res({ code: 'INTERNAL' }, 500),
      joinRequests: res({ code: 'HOUSE_NOT_OWNER' }, 403),
    });

    const house = await fetchHouseBundle(HOUSE, undefined);

    expect(house.houseId).toBe(HOUSE);
    expect(house.missions).toEqual([]);
    expect(house.joinRequests).toEqual([]);
    // 프로필 닉네임이 없으면 멤버 API의 이름으로.
    expect(house.floors.at(-1)!.rooms[0].name).toBe('옛 닉네임');
  });

  it('상세나 멤버 요청이 실패하면 던진다', async () => {
    serve({ detail: res({ code: 'HOUSE_NOT_FOUND' }, 404), members: res(MEMBERS) });
    await expect(fetchHouseBundle(HOUSE, undefined)).rejects.toMatchObject({ status: 404 });

    serve({ detail: res(DETAIL), members: res({ code: 'INTERNAL' }, 500) });
    await expect(fetchHouseBundle(HOUSE, undefined)).rejects.toMatchObject({ status: 500 });
  });

  it('세션 사용자 id로 내 좌석을 고른다', async () => {
    jest.mocked(auth.getSessionUserId).mockReturnValue(9);
    serve({ detail: res(DETAIL), members: res(MEMBERS) });

    const house = await fetchHouseBundle(HOUSE, '나');

    const first = house.floors.at(-1)!.rooms[0];
    expect(first).toMatchObject({ userId: 9, isMine: true, name: '나' });
  });
});
