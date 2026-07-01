import { assetSource } from '@/resources/asset';

describe('assetSource', () => {
  it('draws the label on the placeholder when provided', () => {
    const { uri } = assetSource('furniture/bed', '포근한 침대');
    expect(uri).toContain(`text=${encodeURIComponent('포근한 침대')}`);
    expect(uri).not.toContain(encodeURIComponent('furniture/bed'));
  });

  it('falls back to the key when no label is given', () => {
    const { uri } = assetSource('furniture/bed');
    expect(uri).toContain(`text=${encodeURIComponent('furniture/bed')}`);
  });

  it('falls back to "asset" when nothing is given', () => {
    const { uri } = assetSource();
    expect(uri).toContain('text=asset');
  });
});
