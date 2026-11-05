/**
 * Compile-time checks of the voice AI types, run by `npm run typecheck`.
 */
import type {
  LigueLeadClient,
  VoiceAction,
  VoiceActionCreateParams,
  VoiceActionCredentialsUpdate,
  VoiceActionPublicCredentials,
  VoiceActionUpdateParams,
  VoiceAiSendParams,
} from '@liguelead/api-sdk';

export const webhook: VoiceActionCreateParams = { name: 'n', type: 'HTTP_WEBHOOK', provider: 'internal', endpoint: 'https://x.test' };

// @ts-expect-error an HTTP webhook is an internal action
export const webhookByGoogle: VoiceActionCreateParams = { name: 'n', type: 'HTTP_WEBHOOK', provider: 'google', endpoint: 'https://x.test' };

export const meeting: VoiceActionCreateParams = {
  name: 'n',
  type: 'SCHEDULE_EVENT',
  provider: 'microsoft',
  credentials: { tenant: 't', client_id: 'c', client_secret: 's' },
  config: { destination: 'a@x.test' },
};

// @ts-expect-error Microsoft credentials carry a tenant, not a refresh token
export const wrongCredentials: VoiceActionCreateParams = { name: 'n', type: 'SCHEDULE_EVENT', provider: 'microsoft', credentials: { client_id: 'c', client_secret: 's', refresh_token: 'r' }, config: { destination: 'a@x.test' } };

// @ts-expect-error create still takes the full credentials, the secret included
export const meetingWithoutSecret: VoiceActionCreateParams = { name: 'n', type: 'SCHEDULE_EVENT', provider: 'microsoft', credentials: { tenant: 't', client_id: 'c' }, config: { destination: 'a@x.test' } };

/** What the API answers for a Microsoft action: the account, without the secret. */
export const answered: VoiceAction = {
  id: 'a',
  name: 'n',
  type: 'SCHEDULE_EVENT',
  provider: 'microsoft',
  credentials: { tenant: 't', client_id: 'c' },
  config: { destination: 'a@x.test' },
};

/** What the API answers for a Google action: the client, with no tenant and no secret. */
export const answeredGoogle: VoiceAction = {
  id: 'a',
  name: 'n',
  type: 'SEND_EMAIL',
  provider: 'google',
  credentials: { client_id: 'c' },
  config: { from_address: 'a@x.test', destination: 'b@x.test' },
};

/** True when each type is assignable to the other and both have the same keys. */
type Equals<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? [keyof A] extends [keyof B]
      ? [keyof B] extends [keyof A] ? true : false
      : false
    : false
  : false;

/** The answered credentials are exactly the public ones: no secret, even as an optional field. */
export const exactCredentials: Equals<NonNullable<VoiceAction['credentials']>, VoiceActionPublicCredentials> = true;
export const exactPublicCredentials: Equals<VoiceActionPublicCredentials, { tenant?: string; client_id: string }> = true;

// @ts-expect-error the API never answers the client secret
export const answeredSecret = answered.credentials?.client_secret;

// @ts-expect-error the API never answers the refresh token
export const answeredRefreshToken = answered.credentials?.refresh_token;

// @ts-expect-error the API never answers the webhook's authorization token
export const answeredToken = answered.authorization_token;

/**
 * Sends back the credentials a read returned, which come without their secrets, and then rotates
 * one: the update merges them over the stored ones.
 *
 * @param {LigueLeadClient} client - The client.
 * @param {string} id - The action id.
 * @param {string} secret - The new client secret.
 *
 * @returns {Promise<void>} Resolves after both updates.
 */
export async function sendBackAndRotate(client: LigueLeadClient, id: string, secret: string): Promise<void> {
  const { credentials } = await client.voiceActions.get(id);

  if (credentials) {
    await client.voiceActions.update(id, { credentials });
    await client.voiceActions.update(id, { credentials: { ...credentials, client_secret: secret } });
  }
}

const refreshTokenOnly: VoiceActionCredentialsUpdate = { client_id: 'c', refresh_token: 'r' };
export const rotateRefreshToken: VoiceActionUpdateParams = { credentials: refreshTokenOnly };
export const fullCredentials: VoiceActionUpdateParams = { credentials: { tenant: 't', client_id: 'c', client_secret: 's' } };

// @ts-expect-error update credentials still need the client_id
export const noClientId: VoiceActionUpdateParams = { credentials: { client_secret: 's' } };

export const call: VoiceAiSendParams = {
  title: 't',
  voice_agent_id: 'v',
  phones: ['11999999999', { phone: '11888888888', call_context: null }],
};

// @ts-expect-error each phone entry needs a phone
export const noPhone: VoiceAiSendParams = { title: 't', voice_agent_id: 'v', phones: [{ call_context: 'x' }] };

export const rename: VoiceActionUpdateParams = { name: 'n' };
export const rotate: VoiceActionUpdateParams = { authorization_token: 't', endpoint: 'https://x.test' };

// @ts-expect-error an update needs at least one field; the API refuses an empty body
export const nothing: VoiceActionUpdateParams = {};
