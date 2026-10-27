/**
 * Sends an SMS and follows its delivery.
 *
 *   LIGUELEAD_API_TOKEN=... LIGUELEAD_APP_ID=... npx tsx examples/send-sms.ts 11999999999
 *
 * Costs credits: it sends a real message.
 */
import { setTimeout as wait } from 'node:timers/promises';
import { LigueLeadClient, LigueLeadNotFoundError, LigueLeadValidationError } from '@liguelead/api-sdk';

async function main(): Promise<void> {
  const client = new LigueLeadClient({
    apiToken: process.env.LIGUELEAD_API_TOKEN ?? '',
    appId: process.env.LIGUELEAD_APP_ID,
    environment: 'staging',
  });
  const phone = process.argv[2] ?? '';

  try {
    const { campaign_id } = await client.campaigns.sms.send({ message: 'Olá! Teste do SDK.', phones: [phone] });

    console.log(`accepted: ${campaign_id}`);

    // The campaign is written a few seconds after the send.
    await wait(5000);

    for await (const recipient of client.campaigns.recipients.iterate(campaign_id)) {
      console.log(`${recipient.phone}: ${recipient.status}`);
    }
  } catch (error) {
    if (error instanceof LigueLeadValidationError) {
      console.error('refused:', error.message, error.fieldErrors);
    } else if (error instanceof LigueLeadNotFoundError) {
      console.error('the campaign is not readable yet; try again in a few seconds');
    } else {
      throw error;
    }
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
