/**
 * The RCS update snippet of the README, compiled so it cannot drift from the types.
 */
import type { LigueLeadClient } from '@liguelead/api-sdk';

export async function renameAgent(client: LigueLeadClient, agentId: string): Promise<void> {
  const { id, app_id, status, rejection_reason, use_case, ...current } = await client.rcs.agents.get(agentId);

  await client.rcs.agents.update(agentId, { ...current, sender_name: 'Loja Exemplo Oficial' });
}
