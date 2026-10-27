/**
 * Compile-time checks of the voice AI types, run by `npm run typecheck`.
 */
import type { VoiceActionCreateParams, VoiceActionUpdateParams, VoiceAiSendParams } from '@liguelead/api-sdk';

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
