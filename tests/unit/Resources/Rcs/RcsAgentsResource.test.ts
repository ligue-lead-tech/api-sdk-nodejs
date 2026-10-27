import { LigueLeadBadRequestError, LigueLeadConflictError } from '../../../../src/Errors';
import type { RcsAgentCreateParams } from '../../../../src';
import { appApi, createClient } from '../../Helpers/ApiMocks';

const AGENT_ID = '7b3c1e90-4d2a-4f11-9c8e-2a5b6d0f3e47';

const BRAND = {
  sender_name: 'Loja Exemplo',
  sender_description: 'Ofertas e avisos',
  brand_color: '#FF6600',
  logo_url: 'https://cdn.example.com/logo.png',
  banner_url: 'https://cdn.example.com/banner.png',
  contact_name: 'Maria',
  contact_email: 'maria@example.com',
  company_name: 'Loja Exemplo',
  legal_name: 'Loja Exemplo LTDA',
  company_website: 'https://example.com',
  phone: '+5511999999999',
  public_email: 'contato@example.com',
  public_website: 'https://example.com',
  privacy_policy_url: 'https://example.com/privacidade',
  terms_url: 'https://example.com/termos',
};

const AGENT = {
  ...BRAND,
  id: AGENT_ID,
  app_id: 'e3f1c2a4',
  status: 'submitted',
  rejection_reason: null,
  use_case: 'promotional',
  webhook_url: 'https://api.example.com/webhooks/rcs-agent',
  test_devices: ['+5511999999999'],
};

describe('client.rcs.agents', () => {
  it('lists the agents, answered without an envelope', async () => {
    appApi().get('/v1/rcs/agents').reply(200, [AGENT]);

    await expect(createClient().rcs.agents.list()).resolves.toEqual([AGENT]);
  });

  it('reads one agent', async () => {
    appApi().get(`/v1/rcs/agents/${AGENT_ID}`).reply(200, AGENT);

    await expect(createClient().rcs.agents.get(AGENT_ID)).resolves.toEqual(AGENT);
  });

  it('maps a malformed id to a bad request', async () => {
    appApi().get('/v1/rcs/agents/not-a-uuid').reply(400, { error: 'Invalid agent id' });

    await expect(createClient().rcs.agents.get('not-a-uuid')).rejects.toBeInstanceOf(LigueLeadBadRequestError);
  });

  it('creates the agent', async () => {
    const params: RcsAgentCreateParams = {
      ...BRAND,
      use_case: 'promotional',
      webhook_url: 'https://api.example.com/webhooks/rcs-agent',
      test_devices: ['+5511999999999'],
    };

    appApi().post('/v1/rcs/agents', { ...params }).reply(201, AGENT);

    await expect(createClient().rcs.agents.create(params)).resolves.toEqual(AGENT);
  });

  it('reports a second agent for the app as a conflict', async () => {
    appApi().post('/v1/rcs/agents').reply(409, { error: 'This app already has an RCS agent — read it with GET /v1/rcs/agents' });

    await expect(createClient().rcs.agents.create({ ...BRAND, use_case: 'otp' })).rejects.toBeInstanceOf(LigueLeadConflictError);
  });

  it('replaces the brand, keeping use_case out when omitted', async () => {
    appApi().put(`/v1/rcs/agents/${AGENT_ID}`, BRAND).reply(200, AGENT);

    await expect(createClient().rcs.agents.update(AGENT_ID, BRAND)).resolves.toEqual(AGENT);
  });

  it('deletes an agent, answered 204', async () => {
    appApi().delete(`/v1/rcs/agents/${AGENT_ID}`).reply(204);

    await expect(createClient().rcs.agents.delete(AGENT_ID)).resolves.toBeUndefined();
  });

  it('refuses to delete an approved agent', async () => {
    appApi().delete(`/v1/rcs/agents/${AGENT_ID}`).reply(409, { error: 'The agent is approved and cannot be deleted' });

    await expect(createClient().rcs.agents.delete(AGENT_ID)).rejects.toBeInstanceOf(LigueLeadConflictError);
  });
});
