import { ClientOptions, LigueLeadClient } from '../../src';

/**
 * Settings of the integration run, read from the environment (`.env` is loaded first).
 *
 * The run targets staging unless `LIGUELEAD_BASE_URL` says otherwise, and refuses a production host
 * unless `LIGUELEAD_IT_ALLOW_PRODUCTION=true`: these tests create and delete resources.
 */
export const settings = {
  apiToken: process.env.LIGUELEAD_API_TOKEN ?? '',
  appId: process.env.LIGUELEAD_APP_ID ?? '',
  baseUrl: process.env.LIGUELEAD_BASE_URL || ClientOptions.ENVIRONMENT_BASE_URLS.staging,
  allowProduction: process.env.LIGUELEAD_IT_ALLOW_PRODUCTION === 'true',
  allowWrites: process.env.LIGUELEAD_IT_ALLOW_WRITES === 'true',
  allowPersistentWrites: process.env.LIGUELEAD_IT_ALLOW_PERSISTENT_WRITES === 'true',
  allowSends: process.env.LIGUELEAD_IT_ALLOW_SENDS === 'true',
  phone: process.env.LIGUELEAD_IT_PHONE ?? '',
};

/** Prefix of every resource the run creates, so leftovers are easy to find and remove. */
export const RESOURCE_PREFIX = 'sdk-it-';

/**
 * The client the integration tests use.
 *
 * @param {'app' | 'token'} [scope] - `token` for suites that only call token-scoped routes
 *   (`/apps`), which then run without `LIGUELEAD_APP_ID`.
 *
 * @throws {Error} When the credentials are missing, or the target is production without consent.
 *
 * @returns {LigueLeadClient} A client for the configured environment.
 */
export function integrationClient(scope: 'app' | 'token' = 'app'): LigueLeadClient {
  if (settings.apiToken === '') {
    throw new Error('Set LIGUELEAD_API_TOKEN (see .env.example) to run the integration tests');
  }

  if (scope === 'app' && settings.appId === '') {
    throw new Error('Set LIGUELEAD_APP_ID (see .env.example): this suite calls app-scoped routes');
  }

  if (new URL(settings.baseUrl).hostname === new URL(ClientOptions.ENVIRONMENT_BASE_URLS.production).hostname && !settings.allowProduction) {
    throw new Error('Refusing to run against production; set LIGUELEAD_IT_ALLOW_PRODUCTION=true to do it on purpose');
  }

  return new LigueLeadClient({
    apiToken: settings.apiToken,
    appId: settings.appId === '' ? undefined : settings.appId,
    baseUrl: settings.baseUrl,
    source: 'sdk-it',
  });
}

/** `describe` that only runs when writes the test can undo are allowed. */
export const describeWrites = settings.allowWrites ? describe : describe.skip;

/** `describe` that only runs when writes the API cannot undo (no DELETE route) are allowed. */
export const describePersistentWrites = settings.allowPersistentWrites ? describe : describe.skip;

/** `describe` that only runs when sends — which cost credits and reach a real phone — are allowed. */
export const describeSends = settings.allowSends && settings.phone !== '' ? describe : describe.skip;

/** A random UUID no resource has. */
export const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000000';

/**
 * A valid, silent, 0.1 s WAV (8 kHz, mono, 16-bit PCM).
 *
 * @returns {Buffer} The file bytes.
 */
export function silentWav(): Buffer {
  const samples = 800;
  const data = Buffer.alloc(samples * 2);
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(8000, 24);
  header.writeUInt32LE(16000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);

  return Buffer.concat([header, data]);
}
