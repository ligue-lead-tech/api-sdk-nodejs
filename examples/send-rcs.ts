/**
 * Sends an RCS message through the app's approved agent.
 *
 *   LIGUELEAD_API_TOKEN=... LIGUELEAD_APP_ID=... npx tsx examples/send-rcs.ts 11999999999
 *
 * Costs credits: it sends a real message (or its SMS fallback).
 */
import { LigueLeadClient, LigueLeadValidationError } from '@liguelead/api-sdk';

async function main(): Promise<void> {
  const appId = process.env.LIGUELEAD_APP_ID;
  const client = new LigueLeadClient({
    apiToken: process.env.LIGUELEAD_API_TOKEN ?? '',
    appId,
    environment: 'staging',
  });
  const phone = process.argv[2] ?? '';

  // The list holds the agents of every app of the client; the send only takes this app's agent.
  const agent = (await client.rcs.agents.list()).find(
    (candidate) => candidate.app_id === appId && candidate.status === 'approved',
  );

  if (agent === undefined) {
    console.error('this app has no approved RCS agent; create one with client.rcs.agents.create and wait for the review');
    return;
  }

  try {
    const { campaign_id } = await client.campaigns.rcs.send({
      phones: [phone],
      agent_id: agent.id,
      message: 'Olá! Mensagem RCS enviada pelo SDK da LigueLead.',
    });

    console.log(`accepted: ${campaign_id}`);
  } catch (error) {
    if (error instanceof LigueLeadValidationError) {
      // An agent of another app, or not approved, is refused here, before anything is queued.
      console.error('refused:', error.message);
      return;
    }

    throw error;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
