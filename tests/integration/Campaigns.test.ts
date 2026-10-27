import { setTimeout as wait } from 'node:timers/promises';
import {
  LigueLeadNotFoundError,
  LigueLeadValidationError,
  type CampaignRecipient,
  type RcsSendParams,
} from '../../src';
import { RESOURCE_PREFIX, UNKNOWN_UUID, describeSends, integrationClient, settings } from './IntegrationClient';

const client = integrationClient();

describe('campaigns (no cost)', () => {
  // The API validates the body before queueing anything, so these refusals send nothing.
  it('refuses an SMS without phones, field by field', async () => {
    const error: unknown = await client.campaigns.sms.send({ message: 'x', phones: [] }).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(LigueLeadValidationError);
    expect((error as LigueLeadValidationError).fieldErrors).toContainEqual(
      expect.objectContaining({ field: 'phones' }),
    );
  });

  it('refuses an RCS send with both free text and a template', async () => {
    const params = { phones: ['11999999999'], agent_id: UNKNOWN_UUID, message: 'm', template_id: 't' };

    await expect(client.campaigns.rcs.send(params as unknown as RcsSendParams)).rejects.toBeInstanceOf(LigueLeadValidationError);
  });

  it('refuses a voice send without an audio', async () => {
    await expect(client.campaigns.voice.send({ title: 'x', voice_upload_id: 0, phones: ['11999999999'] }))
      .rejects.toBeInstanceOf(LigueLeadValidationError);
  });

  it('answers 404 for the recipients of an unknown campaign', async () => {
    await expect(client.campaigns.recipients.list(UNKNOWN_UUID)).rejects.toBeInstanceOf(LigueLeadNotFoundError);
  });
});

describeSends('campaigns (sends: cost credits)', () => {
  it('sends an SMS and finds its recipient', async () => {
    const accepted = await client.campaigns.sms.send({
      title: `${RESOURCE_PREFIX}sms`,
      message: 'Teste do SDK Node.js da LigueLead.',
      phones: [settings.phone],
    });

    expect(accepted.campaign_id).toEqual(expect.any(String));

    // The campaign is written a few seconds after the send; until then the API answers 404.
    let recipients: CampaignRecipient[] = [];

    for (let attempt = 0; attempt < 10 && recipients.length === 0; attempt++) {
      await wait(1500);
      recipients = await client.campaigns.recipients.list(accepted.campaign_id)
        .then((page) => page.recipients)
        .catch((error: unknown) => {
          if (error instanceof LigueLeadNotFoundError) {
            return [];
          }

          throw error;
        });
    }

    expect(recipients).toHaveLength(1);

    const walked: CampaignRecipient[] = [];

    for await (const recipient of client.campaigns.recipients.iterate(accepted.campaign_id, { limit: 1 })) {
      walked.push(recipient);
    }

    expect(walked.map((recipient) => recipient.phone)).toEqual(recipients.map((recipient) => recipient.phone));
  });
});
