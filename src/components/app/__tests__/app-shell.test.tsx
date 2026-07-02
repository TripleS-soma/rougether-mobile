import { render } from '@testing-library/react-native';

import { AppShell } from '@/components/app/app-shell';
import { AuthProvider } from '@/hooks/use-auth';

// AppShell loads my-room data from the API on mount; return empty payloads so
// the render is deterministic and hits no network.
const emptyRes = (url: string) => ({
  ok: true,
  status: 200,
  text: async () =>
    JSON.stringify(
      url.endsWith('/today') ? { categories: [], summary: {}, streak: {} } : { items: [] },
    ),
});
const realFetch = global.fetch;
beforeEach(() => {
  global.fetch = jest.fn(async (url: string) => emptyRes(url)) as unknown as typeof fetch;
});
afterEach(() => {
  global.fetch = realFetch;
});

describe('AppShell', () => {
  it('opens on the my-room screen with the bottom nav', async () => {
    const { getByText, getByLabelText } = await render(
      <AuthProvider>
        <AppShell />
      </AuthProvider>,
    );
    expect(getByText('준서의 방')).toBeTruthy(); // MyRoomScreen default
    expect(getByText('오늘의 루틴')).toBeTruthy();
    // Bottom nav tabs present.
    expect(getByLabelText('나의 방')).toBeTruthy();
    expect(getByLabelText('집')).toBeTruthy();
    expect(getByLabelText('설정')).toBeTruthy();
  });
});
