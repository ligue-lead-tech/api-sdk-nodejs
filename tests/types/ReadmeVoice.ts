/**
 * The voice agent update snippet of the README, compiled so it cannot drift from the types.
 */
import type { LigueLeadClient } from '@liguelead/api-sdk';

export async function attachAction(client: LigueLeadClient, agentId: string, actionId: string): Promise<void> {
  const { id, app_id, created_at, updated_at, ...current } = await client.voiceAgents.get(agentId);

  await client.voiceAgents.update(agentId, { ...current, action_id: actionId });
}
