import { LigueLeadNotFoundError } from '../../../../src/Errors';
import { appApi, createClient } from '../../Helpers/ApiMocks';

describe('client.campaigns.voiceAi', () => {
  it('calls with an agent, sending each phone with its context, answered 202 without an envelope', async () => {
    const params = {
      title: 'Lembretes',
      voice_agent_id: 'f9e8d7c6-0000-4000-8000-000000000001',
      phones: ['11999999999', { phone: '11888888888', call_context: 'Nome: Maria; consulta às 14h' }],
      retry_attempts: 1,
      webhook_url: 'https://example.com/hooks?secret=abc',
    };

    appApi().post('/v1/voice-agent/call', params).reply(202, { campaign_id: 'corr-1', phones_count: 2 });

    await expect(createClient().campaigns.voiceAi.send(params)).resolves.toEqual({ campaign_id: 'corr-1', phones_count: 2 });
  });

  it('reports an unknown agent as not found', async () => {
    appApi().post('/v1/voice-agent/call').reply(404, { error: 'Voice agent not found' });

    await expect(createClient().campaigns.voiceAi.send({
      title: 'x',
      voice_agent_id: 'f9e8d7c6-0000-4000-8000-000000000001',
      phones: ['11999999999'],
    })).rejects.toBeInstanceOf(LigueLeadNotFoundError);
  });
});
