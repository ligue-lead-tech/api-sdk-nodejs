/**
 * Compile-time checks of the public types, run by `npm run typecheck`. Each `@ts-expect-error`
 * fails the typecheck if the line below it stops being an error.
 */
import type {
  CampaignRecipientsListParams,
  RcsSendParams,
  VoiceUploadCreateParams,
} from '@liguelead/api-sdk';

export const freeform: RcsSendParams = { phones: ['11999999999'], agent_id: 'a', message: 'm' };
export const template: RcsSendParams = { phones: ['11999999999'], template_id: 't', template_variables: [{ key: '1', value: 'v' }] };

// @ts-expect-error free text and a template are mutually exclusive
export const both: RcsSendParams = { phones: ['11999999999'], agent_id: 'a', message: 'm', template_id: 't' };

// @ts-expect-error the agent of a template send comes from the template
export const templateWithAgent: RcsSendParams = { phones: ['11999999999'], template_id: 't', agent_id: 'a' };

// @ts-expect-error free text needs an agent
export const messageWithoutAgent: RcsSendParams = { phones: ['11999999999'], message: 'm' };

export const page: CampaignRecipientsListParams = { limit: 100, cursor: 'c' };
export const lookup: CampaignRecipientsListParams = { phone: '11999999999' };

// @ts-expect-error a cursor and a phone are mutually exclusive
export const cursorAndPhone: CampaignRecipientsListParams = { cursor: 'c', phone: '11999999999' };

export const named: VoiceUploadCreateParams = { title: 't', file: { data: Buffer.from('x'), filename: 'x.wav' } };

// @ts-expect-error bytes need a file name, or the API cannot see the extension
export const unnamed: VoiceUploadCreateParams = { title: 't', file: Buffer.from('x') };
