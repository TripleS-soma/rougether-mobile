import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearSession, getAccessToken, loadSession } from '@/api/auth';

it('a delayed headless session load cannot restore the account after logout', async () => {
  await clearSession();
  let finishAccess!: (value: string) => void;
  const get = jest.spyOn(AsyncStorage, 'getItem').mockImplementation((key) => {
    if (key.endsWith('accessToken'))
      return new Promise((resolve) => {
        finishAccess = resolve;
      });
    return Promise.resolve(key.endsWith('userId') ? '1' : 'old-refresh');
  });
  const loading = loadSession();
  await clearSession();
  finishAccess('old-token');
  await loading;
  expect(getAccessToken()).toBeNull();
  get.mockRestore();
});
