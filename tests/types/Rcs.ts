/**
 * Compile-time checks of the RCS types, run by `npm run typecheck`.
 */
import type {
  RcsAgentCreateParams,
  RcsCardTemplateCreateParams,
  RcsMediaTemplateCreateParams,
  RcsTemplateButton,
} from '@liguelead/api-sdk';

const base = { agent_id: 'a', title: 't', header: 'h', body: 'b' };

export const byUrl: RcsMediaTemplateCreateParams = { ...base, media_url: 'https://x.test/a.png' };
export const byFile: RcsMediaTemplateCreateParams = { ...base, media_file: 'data:image/png;base64,AA==' };

// @ts-expect-error media_url and media_file are mutually exclusive
export const both: RcsMediaTemplateCreateParams = { ...base, media_url: 'https://x.test/a.png', media_file: 'data:image/png;base64,AA==' };

// @ts-expect-error a media template needs one media
export const none: RcsMediaTemplateCreateParams = { ...base };

export const cardWithoutMedia: RcsCardTemplateCreateParams = { ...base, buttons: [{ type: 'reply', title: 'Ok' }] };

// @ts-expect-error an open_url button needs its url
export const openUrlWithoutUrl: RcsTemplateButton = { type: 'open_url', title: 'Site' };

// @ts-expect-error dial_call takes phone_number, not url
export const dialWithUrl: RcsTemplateButton = { type: 'dial_call', title: 'Ligar', url: 'https://x.test' };

// @ts-expect-error use_case is a closed set in requests
export const badUseCase: Pick<RcsAgentCreateParams, 'use_case'> = { use_case: 'marketing' };
