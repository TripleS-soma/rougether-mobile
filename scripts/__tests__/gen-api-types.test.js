const { tsType } = require('../gen-api-types');

describe('gen-api-types tsType', () => {
  it('wraps nullable array item unions in parentheses', () => {
    expect(
      tsType({
        type: 'array',
        items: { type: 'string', nullable: true },
      }),
    ).toBe('(string | null)[]');
  });

  it('wraps enum array item unions in parentheses', () => {
    expect(
      tsType({
        type: 'array',
        items: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
      }),
    ).toBe('(\"ACTIVE\" | \"INACTIVE\")[]');
  });
});
