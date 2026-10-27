import type { OpenEnum } from './Shared';

/** Answer of an SMS, voice or RCS send: the campaign was accepted and queued. */
export interface CampaignAccepted {
  /** Id of the campaign; webhooks and `campaigns.recipients` refer to it. */
  campaign_id: string;
  /** When the API accepted the send (ISO 8601, UTC). */
  accepted_at: string;
}

/** Fields every send accepts. */
interface SendCommonParams {
  /**
   * Recipients, 1 to 10000 per request. Digits plus `+ ( ) -`, 10 to 16 digits each
   * (`11999999999`, `+5511999999999`).
   */
  phones: string[];
  /**
   * Where to POST this campaign's `campaign.status` events instead of the app's webhook URL. A public
   * http(s) URL of up to 512 characters; kept for 7 days. Replies and postbacks still go to the app's
   * URL. There is no signature: put a secret of your own in the query string to authenticate it.
   */
  webhook_url?: string;
}

/** Body of `campaigns.sms.send`. */
export interface SmsSendParams extends SendCommonParams {
  /** Text, 1 to 1600 characters. Blocked words are refused with a 422. */
  message: string;
  title?: string;
  /** Sends as SMS Flash, shown on the screen without being stored. */
  is_flash?: boolean;
  /** Accepted by the API for compatibility; it does not change the send. */
  group_id?: string;
}

/** Body of `campaigns.voice.send`. */
export interface VoiceSendParams extends SendCommonParams {
  title: string;
  /** Id of an audio from `voice.uploads`, as a number or a numeric string. */
  voice_upload_id: number | string;
  /** Skips the Brazilian phone format check, for international numbers. */
  is_international?: boolean;
  /** Extra attempts for numbers that did not answer, 1 to 3. */
  retry_attempts?: number;
  /** Minutes between attempts, 5 to 180. */
  retry_interval_min?: number;
  /**
   * Last time of day to retry, `HH:MM` in America/Sao_Paulo, between 08:00 and 21:45 and at least
   * 10 minutes from now.
   */
  retry_end_time?: string;
}

/** A `{{n}}` placeholder of an RCS template and its value. */
export interface TemplateVariable {
  /** The placeholder number, as a string (`"1"`). */
  key: string;
  value: string;
}

/** An RCS send with free text, through one of the app's approved agents. */
export interface RcsMessageSendParams extends SendCommonParams {
  /** Id (UUID) of an approved RCS agent of this app. */
  agent_id: string;
  /** Text, up to 306 characters: it is also the SMS fallback when RCS cannot be delivered. */
  message: string;
  template_id?: never;
  template_variables?: never;
}

/** An RCS send of a template; the agent comes from the template. */
export interface RcsTemplateSendParams extends SendCommonParams {
  template_id: string;
  /** Values of the template's placeholders; the template's defaults fill the rest. */
  template_variables?: TemplateVariable[];
  agent_id?: never;
  message?: never;
}

/** Body of `campaigns.rcs.send`: free text with an agent, or a template — never both. */
export type RcsSendParams = RcsMessageSendParams | RcsTemplateSendParams;

/**
 * Delivery status of one recipient, as the API exposes it.
 *
 * Internal states never appear here.
 */
export type RecipientStatus = OpenEnum<
  | 'queued'
  | 'in_progress'
  | 'delivered'
  | 'unreachable'
  | 'invalid_number'
  | 'policy_block'
  | 'opt_out'
  | 'insufficient_credits'
  | 'request_error'
  | 'config_error'
  | 'generic_error'
  | 'unknown_error'
>;

/** One recipient of a campaign. */
export interface CampaignRecipient {
  /** The phone, in E.164 (`+5511999999999`). */
  phone: string;
  status: RecipientStatus;
  /** When it was sent, ISO 8601 with the São Paulo offset. */
  sent_at: string;
  /** When the status last changed, ISO 8601 with the São Paulo offset. */
  updated_at: string;
}

/** One page of `campaigns.recipients.list`. */
export interface CampaignRecipientsPage {
  campaign_id: string;
  campaign_type: OpenEnum<'sms' | 'sms_flash'>;
  recipients: CampaignRecipient[];
  pagination: {
    limit: number;
    /** Cursor of the next page; absent on the last one. */
    next_cursor?: string;
  };
}

/** Query of `campaigns.recipients.list`: a page by cursor, or one phone — never both. */
export type CampaignRecipientsListParams =
  | {
    /** Page size, 1 to 500. The API defaults to 100. */
    limit?: number;
    /** `pagination.next_cursor` of the previous page. */
    cursor?: string;
    phone?: never;
  }
  | {
    limit?: number;
    /** Looks up one recipient; any mask, 10 to 16 digits. */
    phone: string;
    cursor?: never;
  };

/** Options of `campaigns.recipients.iterate`. */
export interface CampaignRecipientsIterateParams {
  /** Page size used under the hood, 1 to 500. */
  limit?: number;
}

/** A phone of a voice AI campaign, with what the agent should know about that call. */
export interface VoiceAiRecipient {
  phone: string;
  /**
   * Context for this call only (name, order, appointment), up to 1500 characters. Line breaks are
   * collapsed into one line.
   */
  call_context?: string | null;
}

/** Body of `campaigns.voiceAi.send`. */
export interface VoiceAiSendParams {
  /** 1 to 200 characters. */
  title: string;
  /** Id (UUID) of the voice agent that makes the calls. */
  voice_agent_id: string;
  /** 1 to 1000 phones, each a string or a phone with its `call_context`. */
  phones: (string | VoiceAiRecipient)[];
  /** Extra attempts for numbers that did not answer, 1 to 3. */
  retry_attempts?: number;
  /** Minutes between attempts, 5 to 180. */
  retry_interval_min?: number;
  /** Last time of day to retry, `HH:MM` in America/Sao_Paulo, between 08:00 and 21:45. */
  retry_end_time?: string;
  /** Where to POST this campaign's `campaign.status` events instead of the app's webhook URL. */
  webhook_url?: string;
}

/** Answer of `campaigns.voiceAi.send`. */
export interface VoiceAiCampaignAccepted {
  campaign_id: string;
  /** How many phones were queued. */
  phones_count: number;
}
