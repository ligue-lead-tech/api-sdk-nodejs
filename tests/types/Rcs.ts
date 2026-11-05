/**
 * Compile-time checks of the RCS types, run by `npm run typecheck`.
 */
import type {
  DataUri,
  RcsAgentCreateParams,
  RcsCardTemplateCreateParams,
  RcsCarouselCard,
  RcsCarouselTemplateCreateParams,
  RcsMediaTemplateCreateParams,
  RcsTemplateButton,
  RcsTemplateCard,
} from '@liguelead/api-sdk';

const base = { agent_id: 'a', title: 't', header: 'h', body: 'b' };

export const byUrl: RcsMediaTemplateCreateParams = { ...base, media_url: 'https://x.test/a.png' };
export const byFile: RcsMediaTemplateCreateParams = { ...base, media_file: 'data:image/png;base64,AA==' };

// @ts-expect-error media_url and media_file are mutually exclusive
export const both: RcsMediaTemplateCreateParams = { ...base, media_url: 'https://x.test/a.png', media_file: 'data:image/png;base64,AA==' };

// @ts-expect-error a media template needs one media
export const none: RcsMediaTemplateCreateParams = { ...base };

const buttons: RcsTemplateButton[] = [{ type: 'reply', title: 'Ok' }];

export const cardByUrl: RcsCardTemplateCreateParams = { ...base, media_url: 'https://x.test/a.png', buttons };
export const cardByFile: RcsCardTemplateCreateParams = { ...base, media_file: 'data:image/png;base64,AA==', buttons };

declare const image: DataUri;

// `DataUri.fromBytes(...)` goes straight into `media_file`, as the README shows.
export const cardByDataUri: RcsCardTemplateCreateParams = { ...base, media_file: image, buttons };

// @ts-expect-error a card needs an image
export const cardWithoutMedia: RcsCardTemplateCreateParams = { ...base, buttons };

// @ts-expect-error a card takes media_url or media_file, never both
export const cardWithBoth: RcsCardTemplateCreateParams = { ...base, media_url: 'https://x.test/a.png', media_file: 'data:image/png;base64,AA==', buttons };

export const carouselCard: RcsCarouselCard = { header: 'h', body: 'b', media_url: 'https://x.test/a.png', buttons };

export const carouselCardByDataUri: RcsCarouselCard = { header: 'h', body: 'b', media_file: image, buttons };

// @ts-expect-error every carousel card needs an image
export const carouselCardWithoutMedia: RcsCarouselCard = { header: 'h', body: 'b', buttons };

export const carousel: RcsCarouselTemplateCreateParams = {
  agent_id: 'a',
  title: 't',
  cards: [carouselCard, { ...carouselCard, header: 'B', media_url: 'https://x.test/b.png' }],
};

// A listed card may still come without one: templates created before the rule keep working.
export const listedCardWithoutMedia: RcsTemplateCard = { header: 'h', body: 'b' };

// @ts-expect-error an open_url button needs its url
export const openUrlWithoutUrl: RcsTemplateButton = { type: 'open_url', title: 'Site' };

// @ts-expect-error dial_call takes phone_number, not url
export const dialWithUrl: RcsTemplateButton = { type: 'dial_call', title: 'Ligar', url: 'https://x.test' };

// @ts-expect-error use_case is a closed set in requests
export const badUseCase: Pick<RcsAgentCreateParams, 'use_case'> = { use_case: 'marketing' };
