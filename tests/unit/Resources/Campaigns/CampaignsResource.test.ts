import {
  LigueLeadConfigurationError,
  LigueLeadInvalidArgumentError,
  LigueLeadNotFoundError,
  LigueLeadValidationError,
} from '../../../../src/Errors';
import { appApi, createClient } from '../../Helpers/ApiMocks';

const ACCEPTED = { campaign_id: '3b4f7c5e-7e2d-4157-b542-5eb2155455c5', accepted_at: '2026-10-07T18:34:38.961Z' };
const CAMPAIGN_ID = '2f7b3c40-0000-4000-8000-000000000001';

describe('client.campaigns.sms', () => {
  it('sends the body as given and returns the accepted campaign', async () => {
    const params = {
      title: 'Welcome',
      message: 'Welcome to LigueLead!',
      phones: ['11999999999', '+5511888888888'],
      webhook_url: 'https://example.com/hooks?secret=abc',
    };

    appApi().post('/v1/sms', params).reply(200, { message: 'SMS accepted successfully', data: ACCEPTED });

    await expect(createClient().campaigns.sms.send(params)).resolves.toEqual(ACCEPTED);
  });

  it('sends SMS Flash through is_flash', async () => {
    appApi()
      .post('/v1/sms', { message: 'code 1234', phones: ['11999999999'], is_flash: true })
      .reply(200, { message: 'SMS Flash accepted successfully', data: ACCEPTED });

    await createClient().campaigns.sms.send({ message: 'code 1234', phones: ['11999999999'], is_flash: true });
  });

  it('passes a blocked-word refusal through unchanged', async () => {
    appApi().post('/v1/sms').reply(422, { error: 'Mensagem contém palavras proibidas: x' });

    const request = createClient().campaigns.sms.send({ message: 'x', phones: ['11999999999'] });

    await expect(request).rejects.toBeInstanceOf(LigueLeadValidationError);
    await expect(request).rejects.toMatchObject({ message: 'Mensagem contém palavras proibidas: x', fieldErrors: [] });
  });

  it('needs an appId', async () => {
    await expect(createClient({ appId: undefined }).campaigns.sms.send({ message: 'x', phones: ['11999999999'] }))
      .rejects.toBeInstanceOf(LigueLeadConfigurationError);
  });
});

describe('client.campaigns.voice', () => {
  it('sends the audio id and the retry policy', async () => {
    const params = {
      title: 'Reminder',
      voice_upload_id: 436514,
      phones: ['11999999999'],
      retry_attempts: 2,
      retry_interval_min: 30,
      retry_end_time: '18:00',
    };

    appApi().post('/v1/voice', params).reply(200, { message: 'Voice accepted successfully', data: ACCEPTED });

    await expect(createClient().campaigns.voice.send(params)).resolves.toEqual(ACCEPTED);
  });
});

describe('client.campaigns.rcs', () => {
  it('sends free text through an agent, answering 202', async () => {
    const params = { phones: ['11999999999'], agent_id: '7b3c1e90-4d2a-4f11-9c8e-2a5b6d0f3e47', message: 'Olá!' };

    appApi().post('/v1/rcs', params).reply(202, { message: 'RCS accepted successfully', data: ACCEPTED });

    await expect(createClient().campaigns.rcs.send(params)).resolves.toEqual(ACCEPTED);
  });

  it('sends a template with its variables', async () => {
    const params = {
      phones: ['11999999999'],
      template_id: 'tmpl_2X8',
      template_variables: [{ key: '1', value: 'Cliente' }],
    };

    appApi().post('/v1/rcs', params).reply(202, { message: 'RCS accepted successfully', data: ACCEPTED });

    await expect(createClient().campaigns.rcs.send(params)).resolves.toEqual(ACCEPTED);
  });

  it('reports an unknown template as not found', async () => {
    appApi().post('/v1/rcs').reply(404, { error: 'Template not found' });

    await expect(createClient().campaigns.rcs.send({ phones: ['11999999999'], template_id: 'nope' }))
      .rejects.toBeInstanceOf(LigueLeadNotFoundError);
  });
});

describe('client.campaigns.recipients', () => {
  function page(phones: string[], nextCursor?: string): object {
    return {
      message: 'Campaign recipients retrieved successfully.',
      data: {
        campaign_id: CAMPAIGN_ID,
        campaign_type: 'sms',
        recipients: phones.map((phone) => ({
          phone,
          status: 'delivered',
          sent_at: '2026-07-29T11:20:03-03:00',
          updated_at: '2026-07-29T11:20:41-03:00',
        })),
        pagination: { limit: 2, ...(nextCursor === undefined ? {} : { next_cursor: nextCursor }) },
      },
    };
  }

  it('reads a page', async () => {
    appApi().get(`/v1/campaigns/${CAMPAIGN_ID}/recipients`).query({ limit: '2', cursor: 'abc' }).reply(200, page(['+551'], 'def'));

    const result = await createClient().campaigns.recipients.list(CAMPAIGN_ID, { limit: 2, cursor: 'abc' });

    expect(result.recipients).toHaveLength(1);
    expect(result.pagination.next_cursor).toBe('def');
  });

  it('reads the first page with no query', async () => {
    appApi().get(`/v1/campaigns/${CAMPAIGN_ID}/recipients`).reply(200, page([]));

    await createClient().campaigns.recipients.list(CAMPAIGN_ID);
  });

  it('looks up one phone', async () => {
    appApi().get(`/v1/campaigns/${CAMPAIGN_ID}/recipients`).query({ phone: '11999999999' }).reply(200, page(['+5511999999999']));

    await createClient().campaigns.recipients.list(CAMPAIGN_ID, { phone: '11999999999' });
  });

  it('walks every page', async () => {
    appApi().get(`/v1/campaigns/${CAMPAIGN_ID}/recipients`).query({ limit: '2' }).reply(200, page(['+551', '+552'], 'c1'));
    appApi().get(`/v1/campaigns/${CAMPAIGN_ID}/recipients`).query({ limit: '2', cursor: 'c1' }).reply(200, page(['+553']));

    const phones: string[] = [];

    for await (const recipient of createClient().campaigns.recipients.iterate(CAMPAIGN_ID, { limit: 2 })) {
      phones.push(recipient.phone);
    }

    expect(phones).toEqual(['+551', '+552', '+553']);
  });

  it('walks with the API default page size', async () => {
    appApi().get(`/v1/campaigns/${CAMPAIGN_ID}/recipients`).reply(200, page([]));

    const phones: string[] = [];

    for await (const recipient of createClient().campaigns.recipients.iterate(CAMPAIGN_ID)) {
      phones.push(recipient.phone);
    }

    expect(phones).toEqual([]);
  });

  it('reports a campaign not written yet, or expired, as not found', async () => {
    appApi().get(`/v1/campaigns/${CAMPAIGN_ID}/recipients`).reply(404, { error: 'Campaign not found' });

    await expect(createClient().campaigns.recipients.list(CAMPAIGN_ID)).rejects.toBeInstanceOf(LigueLeadNotFoundError);
  });

  it('refuses an empty campaign id before any request', async () => {
    await expect(createClient().campaigns.recipients.list('')).rejects.toBeInstanceOf(LigueLeadInvalidArgumentError);
  });
});
