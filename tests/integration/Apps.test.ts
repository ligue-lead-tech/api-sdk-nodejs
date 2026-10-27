import { LigueLeadConflictError, LigueLeadNotFoundError } from '../../src';
import { RESOURCE_PREFIX, describeWrites, integrationClient } from './IntegrationClient';

const client = integrationClient('token');

describe('apps (read-only)', () => {
  it('lists the apps', async () => {
    const apps = await client.apps.list();

    expect(Array.isArray(apps)).toBe(true);
    for (const app of apps) {
      expect(app).toEqual({ id: expect.any(String), name: expect.any(String) });
    }
  });

  it('answers 404 for an app that does not exist', async () => {
    await expect(client.apps.delete('00000000-0000-4000-8000-000000000000')).rejects.toBeInstanceOf(LigueLeadNotFoundError);
  });
});

describeWrites('apps (writes)', () => {
  const name = `${RESOURCE_PREFIX}${String(Date.now())}`;
  let createdId: string | undefined;

  afterAll(async () => {
    if (createdId !== undefined) {
      await client.apps.delete(createdId).catch(() => undefined);
    }
  });

  it('creates, refuses a duplicate, and deletes', async () => {
    const app = await client.apps.create({ name });

    createdId = app.id;
    expect(app.name).toBe(name);

    await expect(client.apps.create({ name })).rejects.toBeInstanceOf(LigueLeadConflictError);

    await expect(client.apps.delete(app.id)).resolves.toEqual({ id: app.id });
    createdId = undefined;
  });
});
