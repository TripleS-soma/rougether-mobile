/* global it, expect, jest */
const { generateKeyPairSync } = require('node:crypto');
const { inspect } = require('../inspect-ios-signing');
const key = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({
  type: 'pkcs8',
  format: 'pem',
});
it('only reads the two fixed bundle identifiers and reports safe profile metadata', async () => {
  const report = jest.fn();
  const request = jest.fn(async (url, options) => {
    expect(options.method).toBe('GET');
    expect(url.startsWith('https://api.appstoreconnect.apple.com/v1/')).toBe(true);
    expect(options.headers.Authorization).toMatch(/^Bearer /);
    return {
      ok: true,
      json: async () => ({
        data: url.includes('/profiles?')
          ? [
              {
                attributes: {
                  profileState: 'ACTIVE',
                  profileType: 'IOS_APP_STORE',
                  expirationDate: '2099-01-01',
                },
                profileContent: 'PRIVATE',
              },
            ]
          : [
              {
                id: 'ABC123',
                attributes: {
                  identifier: url.includes('.widget')
                    ? 'com.triples.rougether.widget'
                    : 'com.triples.rougether',
                },
              },
            ],
      }),
    };
  });
  await inspect({ ASC_API_KEY_P8: key }, request, report);
  expect(request).toHaveBeenCalledTimes(4);
  expect(report).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(report.mock.calls)).not.toMatch(/PRIVATE|Bearer|BEGIN/);
  expect(JSON.stringify(report.mock.calls)).toContain('ACTIVE');
});
it('stops on Apple permission failure without forwarding response content', async () => {
  const report = jest.fn();
  const request = jest.fn(async () => ({
    ok: false,
    status: 403,
    json: async () => ({ secret: 'PRIVATE' }),
  }));
  await expect(inspect({ ASC_API_KEY_P8: key }, request, report)).rejects.toThrow('account access');
  expect(request).toHaveBeenCalledTimes(1);
  expect(report).toHaveBeenCalledWith('{"appleSigningHttpStatus":403}');
});
it('fails before network calls if the designated key is missing', async () => {
  const request = jest.fn();
  await expect(inspect({}, request, jest.fn())).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
});

it('selects the exact app identifier when Apple also returns its widget prefix match', async () => {
  const report = jest.fn();
  const request = jest.fn(async (url) => ({
    ok: true,
    json: async () => ({
      data: url.includes('/profiles?')
        ? []
        : [
            { id: 'MAIN123', attributes: { identifier: 'com.triples.rougether' } },
            { id: 'WIDGET123', attributes: { identifier: 'com.triples.rougether.widget' } },
          ],
    }),
  }));
  await inspect({ ASC_API_KEY_P8: key }, request, report);
  expect(
    request.mock.calls.map(([url]) => url).filter((url) => url.includes('/profiles?')),
  ).toEqual([
    expect.stringContaining('/MAIN123/profiles?'),
    expect.stringContaining('/WIDGET123/profiles?'),
  ]);
  expect(report.mock.calls.every(([line]) => JSON.parse(line).registered === true)).toBe(true);
});
