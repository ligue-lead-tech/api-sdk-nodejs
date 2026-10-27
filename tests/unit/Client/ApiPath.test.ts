import { ApiPath } from '../../../src/Client/ApiPath';
import { LigueLeadInvalidArgumentError } from '../../../src/Errors';

describe('ApiPath', () => {
  it('joins fixed segments and encoded ids', () => {
    expect(ApiPath.of('rcs', 'agents').id('7b3c1e90-4d2a', 'id').toString()).toBe('/rcs/agents/7b3c1e90-4d2a');
    expect(ApiPath.of('apps').id('a/b?c', 'id').toString()).toBe('/apps/a%2Fb%3Fc');
    expect(ApiPath.of('voice', 'uploads').id(436514, 'id').toString()).toBe('/voice/uploads/436514');
    expect(ApiPath.of('campaigns').id('c1', 'campaignId').segment('recipients').toString()).toBe('/campaigns/c1/recipients');
  });

  it('never changes the path it came from', () => {
    const base = ApiPath.of('apps');

    base.id('x', 'id');
    expect(base.toString()).toBe('/apps');
  });

  it.each(['', '   ', '.', '..', Number.NaN, Number.POSITIVE_INFINITY, undefined as unknown as string])(
    'refuses the id %p',
    (value) => {
      expect(() => ApiPath.of('apps').id(value, 'id')).toThrow(LigueLeadInvalidArgumentError);
      expect(() => ApiPath.of('apps').id(value, 'id')).toThrow('id must be a non-empty id');
    },
  );
});
