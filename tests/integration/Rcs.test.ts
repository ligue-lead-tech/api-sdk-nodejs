import { LigueLeadBadRequestError, type RcsAgent } from '../../src';
import { RESOURCE_PREFIX, describePersistentWrites, integrationClient, settings } from './IntegrationClient';

const client = integrationClient();

describe('rcs (read-only)', () => {
  it('lists the agents, and reads the first', async () => {
    const agents = await client.rcs.agents.list();

    expect(Array.isArray(agents)).toBe(true);

    const [first] = agents;

    if (first !== undefined) {
      const agent = await client.rcs.agents.get(first.id);

      expect(agent.id).toBe(first.id);
      expect(agent).toHaveProperty('status');
    }
  });

  it('answers 400 for an agent id that is not a UUID', async () => {
    await expect(client.rcs.agents.get('not-a-uuid')).rejects.toBeInstanceOf(LigueLeadBadRequestError);
  });

  it('lists the templates', async () => {
    const templates = await client.rcs.templates.list();

    expect(Array.isArray(templates)).toBe(true);
    for (const template of templates) {
      expect(template).toEqual(expect.objectContaining({ id: expect.any(String), title: expect.any(String) }));
    }
  });
});

// Creating an agent submits a brand for review, so it is never part of the run. A template needs an
// approved agent; without one the test has nothing to create it under.
describePersistentWrites('rcs (persistent writes)', () => {
  it('creates a text template under an approved agent', async () => {
    // The list is client-wide; templates are created under this app's agent.
    const approved: RcsAgent | undefined = (await client.rcs.agents.list()).find(
      (agent) => agent.app_id === settings.appId && agent.status === 'approved',
    );

    if (approved === undefined) {
      console.warn('this app has no approved RCS agent; skipping template creation');
      return;
    }

    const created = await client.rcs.templates.createText({
      agent_id: approved.id,
      title: `${RESOURCE_PREFIX}${String(Date.now())}`,
      body: 'Olá {{1}}',
      default_variables: [{ key: '1', value: 'Cliente' }],
    });

    expect(created.agent_id).toBe(approved.id);
    expect((await client.rcs.templates.list()).map((template) => template.id)).toContain(created.id);
  });
});
