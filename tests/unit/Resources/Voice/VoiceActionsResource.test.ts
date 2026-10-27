import { isDeepStrictEqual } from 'node:util';
import { LigueLeadBadRequestError, LigueLeadNotFoundError } from '../../../../src/Errors';
import type { VoiceActionCreateParams } from '../../../../src';
import { appApi, createClient } from '../../Helpers/ApiMocks';

const ACTION_ID = 'act_1';

describe('client.voiceActions', () => {
  it('lists the actions', async () => {
    const action = { id: ACTION_ID, name: 'Transferir', type: 'TRANSFER_CALL', provider: 'internal', phone: '11999999999' };

    appApi().get('/v1/voice-action').reply(200, [action]);

    await expect(createClient().voiceActions.list()).resolves.toEqual([action]);
  });

  it('reads one action', async () => {
    appApi().get(`/v1/voice-action/${ACTION_ID}`).reply(404, { error: 'Action not found' });

    await expect(createClient().voiceActions.get(ACTION_ID)).rejects.toBeInstanceOf(LigueLeadNotFoundError);
  });

  it.each<[string, VoiceActionCreateParams]>([
    ['an HTTP webhook', { name: 'CRM', type: 'HTTP_WEBHOOK', provider: 'internal', endpoint: 'https://crm.example.com/hook', authorization_token: 'secret' }],
    ['an SMS', { name: 'Confirmação', type: 'SEND_SMS', provider: 'internal', message: 'Consulta confirmada.' }],
    ['a Google meeting', {
      name: 'Agenda',
      type: 'SCHEDULE_EVENT',
      provider: 'google',
      credentials: { client_id: 'c', client_secret: 's', refresh_token: 'r' },
      config: { destination: 'agenda@example.com', timezone: 'America/Sao_Paulo' },
    }],
    ['a Microsoft email', {
      name: 'Email',
      type: 'SEND_EMAIL',
      provider: 'microsoft',
      credentials: { tenant: 't', client_id: 'c', client_secret: 's' },
      config: { from_address: 'no-reply@example.com', destination: 'vendas@example.com' },
    }],
  ])('creates %s', async (_label, params) => {
    appApi().post('/v1/voice-action', (body: unknown) => isDeepStrictEqual(body, params)).reply(201, { id: ACTION_ID, ...params });

    await expect(createClient().voiceActions.create(params)).resolves.toMatchObject({ id: ACTION_ID, type: params.type });
  });

  it('reports the 50-action limit as a bad request', async () => {
    appApi().post('/v1/voice-action').reply(400, { error: 'Maximum of 50 actions reached' });

    await expect(createClient().voiceActions.create({ name: 'x', type: 'TRANSFER_CALL', provider: 'internal', phone: '11999999999' }))
      .rejects.toBeInstanceOf(LigueLeadBadRequestError);
  });

  it('updates some fields', async () => {
    appApi().put(`/v1/voice-action/${ACTION_ID}`, { name: 'Novo nome' }).reply(200, { id: ACTION_ID, name: 'Novo nome' });

    await expect(createClient().voiceActions.update(ACTION_ID, { name: 'Novo nome' })).resolves.toMatchObject({ name: 'Novo nome' });
  });

  it('deletes an action, answered 204', async () => {
    appApi().delete(`/v1/voice-action/${ACTION_ID}`).reply(204);

    await expect(createClient().voiceActions.delete(ACTION_ID)).resolves.toBeUndefined();
  });
});
