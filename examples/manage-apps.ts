/**
 * Lists the client's apps and creates one if it does not exist yet.
 *
 *   LIGUELEAD_API_TOKEN=... npx tsx examples/manage-apps.ts "My ERP Integration"
 *
 * The `/apps` routes need only the token, so this runs before the client has an app id.
 */
import { LigueLeadClient, LigueLeadConflictError } from '@liguelead/api-sdk';

async function main(): Promise<void> {
  const client = new LigueLeadClient({
    apiToken: process.env.LIGUELEAD_API_TOKEN ?? '',
    environment: 'staging',
  });
  const name = process.argv[2] ?? 'My ERP Integration';

  for (const app of await client.apps.list()) {
    console.log(`${app.id}  ${app.name}`);
  }

  try {
    const app = await client.apps.create({ name });

    console.log(`created ${app.id}; send it as appId to call the other routes`);
  } catch (error) {
    if (error instanceof LigueLeadConflictError) {
      console.log(`an app named "${name}" already exists`);
      return;
    }

    throw error;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
