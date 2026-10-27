import { LigueLeadConflictError, LigueLeadInvalidArgumentError, LigueLeadNotFoundError } from '../../../src/Errors';
import { createClient, tokenApi } from '../Helpers/ApiMocks';

describe('client.apps', () => {
  it('lists the apps with the token alone', async () => {
    tokenApi()
      .get('/v1/apps')
      .reply(200, { message: 'Success', data: [{ id: '6f1c9d24', name: 'My ERP Integration' }] });

    await expect(createClient().apps.list()).resolves.toEqual([{ id: '6f1c9d24', name: 'My ERP Integration' }]);
  });

  it('creates an app', async () => {
    tokenApi()
      .post('/v1/apps', { name: 'My ERP Integration' })
      .reply(201, { message: 'App created successfully', data: { id: '6f1c9d24', name: 'My ERP Integration' } });

    await expect(createClient({ appId: undefined }).apps.create({ name: 'My ERP Integration' }))
      .resolves.toEqual({ id: '6f1c9d24', name: 'My ERP Integration' });
  });

  it('reports a duplicate name as a conflict', async () => {
    tokenApi().post('/v1/apps').reply(409, { error: 'An app with this name already exists' });

    const request = createClient().apps.create({ name: 'Dup' });

    await expect(request).rejects.toBeInstanceOf(LigueLeadConflictError);
    await expect(request).rejects.toThrow('An app with this name already exists');
  });

  it('deletes an app, encoding its id', async () => {
    tokenApi()
      .delete('/v1/apps/a%2Fb')
      .reply(200, { message: 'App removed successfully', data: { id: 'a/b' } });

    await expect(createClient().apps.delete('a/b')).resolves.toEqual({ id: 'a/b' });
  });

  it('reports an unknown app as not found', async () => {
    tokenApi().delete('/v1/apps/nope').reply(404, { error: 'App not found' });

    await expect(createClient().apps.delete('nope')).rejects.toMatchObject({
      constructor: LigueLeadNotFoundError,
      routeNotFound: false,
    });
  });

  it('refuses an empty id before any request', async () => {
    await expect(createClient().apps.delete('')).rejects.toBeInstanceOf(LigueLeadInvalidArgumentError);
  });
});
