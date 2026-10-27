import type { DataUri } from '../Support/DataUri';
import type { TemplateVariable } from './Campaigns';
import type { OpenEnum } from './Shared';

/** A button that sends `postback_data` back as an `rcs.inbound.postback` event. */
export interface RcsReplyButton {
  type: 'reply';
  /** Up to 25 characters. */
  title: string;
  /** Up to 2048 characters. */
  postback_data?: string;
}

/** A button that opens a page. */
export interface RcsOpenUrlButton {
  type: 'open_url';
  /** Up to 25 characters. */
  title: string;
  /** An `https://` URL. */
  url: string;
}

/** A button that dials a number. */
export interface RcsDialCallButton {
  type: 'dial_call';
  /** Up to 25 characters. */
  title: string;
  /** E.164 (`+5511987654321`). */
  phone_number: string;
}

/** A button of a card or of a carousel card. */
export type RcsTemplateButton = RcsReplyButton | RcsOpenUrlButton | RcsDialCallButton;

/**
 * The image or video of a template: a public `https://` URL, or the file itself as a base64 data URI
 * (`data:image/png;base64,…` — a `DataUri` is written as one). Never both.
 */
export type RcsMediaSource =
  | {
    media_url: string;
    media_file?: never
  }
  | {
    media_file: string | DataUri;
    media_url?: never
  };

/** Media is optional on cards: one source, or none. */
export type RcsOptionalMediaSource = RcsMediaSource | {
  media_url?: never;
  media_file?: never
};

/** Fields every template takes. */
export interface RcsTemplateBaseParams {
  /** 1 to 255 characters. */
  title: string;
  /** The agent (UUID) the template belongs to; its sends go out as this agent. */
  agent_id: string;
  /** Values used for `{{n}}` placeholders the send does not fill. Keys must not repeat. */
  default_variables?: TemplateVariable[];
  /** SMS sent when RCS cannot be delivered, 1 to 306 characters. */
  fallback_message?: string;
}

/** Body of `rcs.templates.createText`. */
export interface RcsTextTemplateCreateParams extends RcsTemplateBaseParams {
  /** 1 to 1600 characters, with `{{1}}`-style placeholders. */
  body: string;
}

/** Body of `rcs.templates.createMedia`: a header, a body and one media. */
export type RcsMediaTemplateCreateParams = RcsTemplateBaseParams & RcsMediaSource & {
  /** 1 to 100 characters. */
  header: string;
  body: string;
};

/** Body of `rcs.templates.createCard`: a rich card with 1 to 4 buttons and optional media. */
export type RcsCardTemplateCreateParams = RcsTemplateBaseParams & RcsOptionalMediaSource & {
  header: string;
  body: string;
  buttons: RcsTemplateButton[];
};

/** One card of a carousel: up to 2 buttons, the same count and types in every card. */
export type RcsCarouselCard = RcsOptionalMediaSource & {
  header: string;
  body: string;
  buttons: RcsTemplateButton[];
};

/** Body of `rcs.templates.createCarousel`: 2 to 10 cards. */
export interface RcsCarouselTemplateCreateParams extends RcsTemplateBaseParams {
  cards: RcsCarouselCard[];
}

/** Answer of every `rcs.templates.create*`. */
export interface RcsTemplateCreated {
  /** The template id, sent as `template_id`. */
  id: string;
  title: string;
  agent_id: string;
}

/** Kinds of template. */
export type RcsTemplateType = OpenEnum<'text' | 'media' | 'card' | 'carousel'>;

/** A card of a listed carousel. */
export interface RcsTemplateCard {
  header: string;
  body: string;
  media_url?: string;
  buttons?: RcsTemplateButton[];
}

/** A template as `rcs.templates.list` returns it: the fields given at creation, by type. */
export interface RcsTemplate {
  id: string;
  title: string;
  type: RcsTemplateType;
  agent_id?: string;
  fallback_message?: string;
  body?: string;
  header?: string;
  media_url?: string;
  buttons?: RcsTemplateButton[];
  cards?: RcsTemplateCard[];
}
