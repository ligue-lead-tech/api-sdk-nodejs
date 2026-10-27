import { LigueLeadNotFoundError, LigueLeadValidationError } from '../../../../src/Errors';
import { appApi, createClient } from '../../Helpers/ApiMocks';

const AGENT_ID = 'f9e8d7c6-0000-4000-8000-000000000001';
const AGENT = {
  id: AGENT_ID,
  app_id: 'app_test_42',
  name: 'Lembrete',
  prompt: 'Você lembra o cliente da consulta.',
  engine: { version: 'lumen-1', voice_id: 'voice-a' },
  greetings: 'Olá!',
  stability: 0.7,
  similarity_boost: 0.75,
  speed: 1,
  created_at: '2026-10-01T12:00:00.000Z',
  updated_at: '2026-10-01T12:00:00.000Z',
};
const PARAMS = {
  name: 'Lembrete',
  prompt: 'Você lembra o cliente da consulta.',
  engine: { version: 'lumen-1', voice_id: 'voice-a' },
  greetings: 'Olá!',
};

describe('client.voiceAgents', () => {
  it('lists the agents, answered without an envelope', async () => {
    appApi().get('/v1/voice-agent').reply(200, [AGENT]);

    await expect(createClient().voiceAgents.list()).resolves.toEqual([AGENT]);
  });

  it('reads one agent', async () => {
    appApi().get(`/v1/voice-agent/${AGENT_ID}`).reply(200, AGENT);

    await expect(createClient().voiceAgents.get(AGENT_ID)).resolves.toEqual(AGENT);
  });

  it('reports an unknown agent as not found', async () => {
    appApi().get(`/v1/voice-agent/${AGENT_ID}`).reply(404, { error: 'Voice agent not found' });

    await expect(createClient().voiceAgents.get(AGENT_ID)).rejects.toBeInstanceOf(LigueLeadNotFoundError);
  });

  it('creates an agent', async () => {
    appApi().post('/v1/voice-agent', PARAMS).reply(201, AGENT);

    await expect(createClient().voiceAgents.create(PARAMS)).resolves.toEqual(AGENT);
  });

  it('passes the engine refusal through', async () => {
    appApi().post('/v1/voice-agent').reply(422, {
      error: [{ field: 'engine.voice_id', message: 'Unknown engine.voice_id — see GET /v1/voice-agent/voices for the voices available per engine' }],
    });

    await expect(createClient().voiceAgents.create({ ...PARAMS, engine: { version: 'lumen-1', voice_id: 'nope' } }))
      .rejects.toMatchObject({ constructor: LigueLeadValidationError, fieldErrors: [{ field: 'engine.voice_id' }] });
  });

  it('replaces an agent', async () => {
    const params = { ...PARAMS, engine: { version: 'prisma-1', voice_id: 'voice-b' } };

    appApi().put(`/v1/voice-agent/${AGENT_ID}`, params).reply(200, { ...AGENT, engine: params.engine });

    await expect(createClient().voiceAgents.update(AGENT_ID, params)).resolves.toMatchObject({ engine: params.engine });
  });

  it('lists the voices of each engine', async () => {
    const catalog = { engines: [{ version: 'lumen-1', voices: [{ id: 'voice-a', name: 'Ana', gender: 'female' }] }] };

    appApi().get('/v1/voice-agent/voices').reply(200, catalog);

    await expect(createClient().voiceAgents.listVoices()).resolves.toEqual(catalog);
  });
});
