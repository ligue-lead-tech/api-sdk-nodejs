import { isDeepStrictEqual } from 'node:util';
import { LigueLeadBadRequestError, LigueLeadNotFoundError, LigueLeadValidationError } from '../../../../src/Errors';
import type { VoiceAction, VoiceActionCreateParams } from '../../../../src';
import { appApi, createClient } from '../../Helpers/ApiMocks';

const ACTION_ID = 'act_1';

/** A Microsoft action as the API answers it: the account, without the secret. */
const MICROSOFT_ACTION: VoiceAction = {
  id: ACTION_ID,
  name: 'Email',
  type: 'SEND_EMAIL',
  provider: 'microsoft',
  credentials: { tenant: 't', client_id: 'c' },
  config: { from_address: 'no-reply@example.com', destination: 'vendas@example.com' },
};

describe('client.voiceActions', () => {
  it('lists the actions', async () => {
    const action = { id: ACTION_ID, name: 'Transferir', type: 'TRANSFER_CALL', provider: 'internal', phone: '11999999999' };

    appApi().get('/v1/voice-action').reply(200, [action, MICROSOFT_ACTION]);

    await expect(createClient().voiceActions.list()).resolves.toEqual([action, MICROSOFT_ACTION]);
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
  ])('creates %s, sending the secrets', async (_label, params) => {
    appApi().post('/v1/voice-action', (body: unknown) => isDeepStrictEqual(body, params))
      .reply(201, { id: ACTION_ID, name: params.name, type: params.type, provider: params.provider });

    await expect(createClient().voiceActions.create(params)).resolves.toMatchObject({ id: ACTION_ID, type: params.type });
  });

  it('answers a created action without its secrets', async () => {
    appApi().post('/v1/voice-action').reply(201, MICROSOFT_ACTION);

    const action = await createClient().voiceActions.create({
      name: 'Email',
      type: 'SEND_EMAIL',
      provider: 'microsoft',
      credentials: { tenant: 't', client_id: 'c', client_secret: 's' },
      config: { from_address: 'no-reply@example.com', destination: 'vendas@example.com' },
    });

    expect(action.credentials).toEqual({ tenant: 't', client_id: 'c' });
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

  it('sends back the credentials a read returned, without the secrets', async () => {
    const credentials = { tenant: 't', client_id: 'c' };

    appApi().put(`/v1/voice-action/${ACTION_ID}`, (body: unknown) => isDeepStrictEqual(body, { credentials }))
      .reply(200, MICROSOFT_ACTION);

    await expect(createClient().voiceActions.update(ACTION_ID, { credentials })).resolves.toEqual(MICROSOFT_ACTION);
  });

  it('reports credentials incomplete for the provider as a validation error', async () => {
    appApi().put(`/v1/voice-action/${ACTION_ID}`).reply(422, { error: 'credentials are incomplete for a google action' });

    const request = createClient().voiceActions.update(ACTION_ID, { credentials: { client_id: 'c' } });

    await expect(request).rejects.toBeInstanceOf(LigueLeadValidationError);
    await expect(request).rejects.toMatchObject({ message: 'credentials are incomplete for a google action', fieldErrors: [] });
  });

  it('deletes an action, answered 204', async () => {
    appApi().delete(`/v1/voice-action/${ACTION_ID}`).reply(204);

    await expect(createClient().voiceActions.delete(ACTION_ID)).resolves.toBeUndefined();
  });
});
