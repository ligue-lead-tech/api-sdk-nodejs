/**
 * Calls a phone with an existing voice agent, giving the agent context about that call.
 *
 *   LIGUELEAD_API_TOKEN=... LIGUELEAD_APP_ID=... npx tsx examples/voice-agent-call.ts 11999999999
 *
 * Costs credits: it places a real call.
 */
import { LigueLeadClient } from '@liguelead/api-sdk';

async function main(): Promise<void> {
  const client = new LigueLeadClient({
    apiToken: process.env.LIGUELEAD_API_TOKEN ?? '',
    appId: process.env.LIGUELEAD_APP_ID,
    environment: 'staging',
  });
  const phone = process.argv[2] ?? '';

  const [agent] = await client.voiceAgents.list();

  if (agent === undefined) {
    console.error('no voice agent; create one with client.voiceAgents.create');
    return;
  }

  console.log(`calling with "${agent.name}" (${String(agent.engine.version)})`);

  const { campaign_id, phones_count } = await client.campaigns.voiceAi.send({
    title: 'SDK example',
    voice_agent_id: agent.id,
    phones: [{ phone, call_context: 'Nome: Cliente de teste; motivo: demonstração do SDK' }],
  });

  console.log(`accepted: ${campaign_id} (${String(phones_count)} phone)`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
