import { assetSource } from '@/resources/asset';

describe('assetSource', () => {
  it('encodes the key into the placeholder URL', () => {
    const { uri } = assetSource('furniture/bed');
    expect(uri).toContain(`text=${encodeURIComponent('furniture/bed')}`);
  });

  it('falls back to "asset" when no key is given', () => {
    const { uri } = assetSource();
    expect(uri).toContain('text=asset');
  });
});
