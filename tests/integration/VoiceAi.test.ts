import {
  LigueLeadNotFoundError,
  LigueLeadValidationError,
  type VoiceAction,
} from '../../src';
import {
  RESOURCE_PREFIX,
  UNKNOWN_UUID,
  describePersistentWrites,
  describeWrites,
  integrationClient,
} from './IntegrationClient';

const client = integrationClient();

describe('voice AI (read-only and refusals)', () => {
  it('lists the voice agents, and reads the first', async () => {
    const agents = await client.voiceAgents.list();

    expect(Array.isArray(agents)).toBe(true);

    const [first] = agents;

    if (first !== undefined) {
      const agent = await client.voiceAgents.get(first.id);

      expect(agent.id).toBe(first.id);
      expect(agent.engine).toEqual({ version: expect.any(String), voice_id: expect.any(String) });
    }
  });

  it('lists the voices of every engine', async () => {
    const catalog = await client.voiceAgents.listVoices();

    expect(catalog.engines.length).toBeGreaterThan(0);
    for (const engine of catalog.engines) {
      expect(engine.voices.length).toBeGreaterThan(0);
    }
  });

  it('lists the voice actions', async () => {
    await expect(client.voiceActions.list()).resolves.toEqual(expect.any(Array));
  });

  it('refuses a call with a malformed agent id', async () => {
    await expect(client.campaigns.voiceAi.send({ title: 'x', voice_agent_id: 'not-a-uuid', phones: ['11999999999'] }))
      .rejects.toBeInstanceOf(LigueLeadValidationError);
  });

  it('answers 404 for a call with an unknown agent', async () => {
    await expect(client.campaigns.voiceAi.send({ title: 'x', voice_agent_id: UNKNOWN_UUID, phones: ['11999999999'] }))
      .rejects.toBeInstanceOf(LigueLeadNotFoundError);
  });
});

describeWrites('voice actions (writes)', () => {
  let created: VoiceAction | undefined;

  afterAll(async () => {
    if (created !== undefined) {
      await client.voiceActions.delete(created.id).catch(() => undefined);
    }
  });

  it('creates, updates and deletes an HTTP webhook action', async () => {
    created = await client.voiceActions.create({
      name: `${RESOURCE_PREFIX}${String(Date.now())}`,
      type: 'HTTP_WEBHOOK',
      provider: 'internal',
      endpoint: 'https://example.com/ligue-lead-sdk-it',
    });

    expect(created).toMatchObject({ type: 'HTTP_WEBHOOK', provider: 'internal' });

    const renamed = await client.voiceActions.update(created.id, { name: `${created.name}-renamed` });

    expect(renamed.name).toBe(`${created.name}-renamed`);

    await client.voiceActions.delete(created.id);
    await expect(client.voiceActions.get(created.id)).rejects.toBeInstanceOf(LigueLeadNotFoundError);
    created = undefined;
  });
});

// The API has no route to delete a voice agent: what this creates stays in the app.
describePersistentWrites('voice agents (persistent writes)', () => {
  it('creates an agent with a voice from the catalog', async () => {
    const catalog = await client.voiceAgents.listVoices();
    const engine = catalog.engines.find((candidate) => candidate.version === 'lumen-mini') ?? catalog.engines[0];
    const voice = engine?.voices[0];

    if (engine === undefined || voice === undefined) {
      throw new Error('the voice catalog is empty');
    }

    const agent = await client.voiceAgents.create({
      name: `${RESOURCE_PREFIX}${String(Date.now())}`,
      prompt: 'Você é um agente de teste do SDK. Agradeça e encerre a ligação.',
      engine: { version: engine.version, voice_id: voice.id },
    });

    expect(agent.engine).toEqual({ version: engine.version, voice_id: voice.id });
    await expect(client.voiceAgents.get(agent.id)).resolves.toMatchObject({ id: agent.id });
  });
});
