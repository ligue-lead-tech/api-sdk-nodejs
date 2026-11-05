/**
 * The RCS snippets of the README, compiled so they cannot drift from the types.
 */
import type { LigueLeadClient } from '@liguelead/api-sdk';

export async function renameAgent(client: LigueLeadClient, agentId: string): Promise<void> {
  const { id, app_id, status, rejection_reason, use_case, ...current } = await client.rcs.agents.get(agentId);

  await client.rcs.agents.update(agentId, { ...current, sender_name: 'Loja Exemplo Oficial' });
}

export async function createCarousel(client: LigueLeadClient, agent: { id: string }): Promise<void> {
  const card = (header: string, image: string) => ({
    header,
    body: 'Toque para ver',
    media_url: image,
    buttons: [{ type: 'open_url' as const, title: 'Ver', url: 'https://loja.exemplo.com.br' }],
  });

  await client.rcs.templates.createCarousel({
    agent_id: agent.id,
    title: 'Vitrine',
    cards: [
      card('Tênis', 'https://loja.exemplo.com.br/tenis.png'),
      card('Mochila', 'https://loja.exemplo.com.br/mochila.png'),
    ],
  });
}
