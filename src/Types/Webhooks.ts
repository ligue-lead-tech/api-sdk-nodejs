import type { OpenEnum } from './Shared';

/** Fields every event carries. */
export interface WebhookEnvelope<E extends string = string> {
  event: E;
  /** The app the event belongs to. Empty on an SMS reply that could not be matched to a send. */
  app_id: string;
  /**
   * When LigueLead issued this notification (ISO 8601, UTC) — not when the event happened. A retry
   * carries the same value; a second notification of the same status carries its own.
   */
  occurred_at: string;
}

/** Fields of the campaign in every `campaign.status` event. */
export interface CampaignStatusBase {
  /** The `campaign_id` the send returned. */
  id: string;
  /** The `source` header of the send (`api` when none was sent). */
  source: string;
  /** The recipient, in E.164. */
  phone: string;
  credits_required: number;
  /**
   * When it was sent — for `insufficient_credits`, when it was due to go out. SMS, SMS Flash and RCS
   * carry the São Paulo offset, or a date alone on older campaigns; voice and voice AI carry UTC.
   * Parse it as ISO 8601 — except a date alone, which has no time: `new Date()` reads it as UTC
   * midnight, the evening before in São Paulo; take it as that São Paulo day.
   */
  sent_at: string;
}

/** Delivery status of an SMS. Today the API only emits `delivered`; handle the others too. */
export type SmsCampaignStatus = OpenEnum<'sent' | 'delivered' | 'undelivered' | 'failed'>;

/**
 * Delivery status of an RCS message. `insufficient_credits`: the RCS balance did not cover the message
 * when it was due to go out — it was not sent, no credit was consumed, and the phone gets no other
 * status, not even `sent`.
 */
export type RcsCampaignStatus = OpenEnum<
  'sent' | 'delivered' | 'read' | 'undelivered' | 'failed' | 'insufficient_credits'
>;

/**
 * Outcome of a call. `insufficient_credits`: the balance did not cover the call when it was due to be
 * dialed — it was not dialed, no credit was consumed, and the phone gets no other status, not even
 * `sent`.
 */
export type VoiceCampaignStatus = OpenEnum<
  'sent' | 'answer' | 'no_answer' | 'invalid_number' | 'failed' | 'insufficient_credits'
>;

/** What a voice agent did to end or during the call. */
export type VoiceAiActionExecuted = OpenEnum<
  | 'none'
  | 'end_call'
  | 'transfer_call'
  | 'schedule_event'
  | 'send_email'
  | 'send_sms'
  | 'http_webhook'
  | 'voice_mail'
  | 'silence_timeout'
  | 'virtual_assistant'
  | 'check_availability'
>;

/** An SMS or SMS Flash. An RCS message that fell back to SMS arrives as `sms`, with the RCS campaign id. */
export interface SmsCampaignStatusPayload extends CampaignStatusBase {
  type: 'sms' | 'sms_flash';
  message: string;
  status: SmsCampaignStatus;
}

/** An RCS message, free text or template. */
export interface RcsCampaignStatusPayload extends CampaignStatusBase {
  type: 'rcs_basic' | 'rcs_single';
  message?: string;
  template_id?: string;
  template_title?: string;
  status: RcsCampaignStatus;
}

/** A call that played an uploaded audio. */
export interface VoiceCampaignStatusPayload extends CampaignStatusBase {
  type: 'voice';
  status: VoiceCampaignStatus;
  audio_id?: number;
  audio_title?: string;
  audio_time?: string;
  duration_sec?: number;
  recording_url?: string;
  /** Keys the recipient pressed; present only when there were any. */
  dtmf?: string;
}

/** One turn of the conversation of an AI call. */
export interface VoiceAiTranscriptTurn {
  role: OpenEnum<'assistant' | 'user'>;
  content: string;
}

/** A call made by a voice agent. */
export interface VoiceAiCampaignStatusPayload extends CampaignStatusBase {
  type: 'voice_ai';
  status: VoiceCampaignStatus;
  duration_sec?: number;
  recording_url?: string;
  /** On every outcome of the call; absent on `sent` and `insufficient_credits`, which come before it. */
  action_executed?: VoiceAiActionExecuted;
  transcript?: VoiceAiTranscriptTurn[];
}

/** The campaign of a `campaign.status` event, by channel. */
export type CampaignStatusPayload =
  | SmsCampaignStatusPayload
  | RcsCampaignStatusPayload
  | VoiceCampaignStatusPayload
  | VoiceAiCampaignStatusPayload;

/**
 * A recipient's status changed. Goes to the send's `webhook_url` when it had one, otherwise to the
 * app's webhook URL.
 */
export interface CampaignStatusEventBody<C extends CampaignStatusPayload = CampaignStatusPayload>
  extends WebhookEnvelope<'campaign.status'> {
  campaign: C;
}

/** `campaign.status` of an SMS or SMS Flash. */
export type SmsCampaignStatusEventBody = CampaignStatusEventBody<SmsCampaignStatusPayload>;
/** `campaign.status` of an RCS message. */
export type RcsCampaignStatusEventBody = CampaignStatusEventBody<RcsCampaignStatusPayload>;
/** `campaign.status` of a call with an uploaded audio. */
export type VoiceCampaignStatusEventBody = CampaignStatusEventBody<VoiceCampaignStatusPayload>;
/** `campaign.status` of a call by a voice agent. */
export type VoiceAiCampaignStatusEventBody = CampaignStatusEventBody<VoiceAiCampaignStatusPayload>;

/** The recipient tapped a reply button of an RCS card. Always goes to the app's webhook URL. */
export interface RcsInboundPostbackEventBody extends WebhookEnvelope<'rcs.inbound.postback'> {
  campaign: Omit<RcsCampaignStatusPayload, 'status'> & {
    inbound: {
      type: 'postback';
      /** The `postback_data` of the button. */
      postback_data: string;
    };
  };
}

/**
 * The recipient replied to an SMS. Matching the reply to its send is best effort: `campaign.id`
 * (and `app_id`) may be empty.
 */
export interface SmsInboundEventBody extends WebhookEnvelope<'sms.inbound'> {
  campaign: {
    id: string;
    phone: string;
    message: string;
  };
}

/** The review of an RCS agent moved. Goes to the agent's own `webhook_url`. */
export interface RcsAgentStatusEventBody extends WebhookEnvelope<'rcs.agent.status'> {
  agent: {
    id: string;
    status: OpenEnum<'under_review' | 'approved' | 'rejected'>;
    rejection_reason: string | null;
  };
}

/** The body of every event this SDK knows. */
export type KnownWebhookEventBody =
  | CampaignStatusEventBody
  | RcsInboundPostbackEventBody
  | SmsInboundEventBody
  | RcsAgentStatusEventBody;

/**
 * The body of an event this SDK does not know yet. The API adds events without notice, so a
 * handler should accept and ignore what it does not recognize rather than fail.
 */
export interface UnknownWebhookEventBody extends WebhookEnvelope {
  [key: string]: unknown;
}

/** The body of any event: one the SDK knows, or one it does not know yet. */
export type WebhookEventBody = KnownWebhookEventBody | UnknownWebhookEventBody;

/**
 * The request headers `WebhookEvent.parse` reads the delivery headers from: a Fetch `Headers`, or a
 * plain object — Node's `req.headers` (`node:http`, Express) or an API Gateway event's `headers` —,
 * whose names are matched without regard to case.
 *
 * The `get` form is the Fetch contract, `string | null`, and must ignore case as Fetch does: the SDK
 * asks for `X-LigueLead-Delivery-Id` as the API spells it. That return type keeps out a `Map`, whose
 * `get` matches case and returns `undefined`, so lowercase keys would read as no header in silence.
 */
export type WebhookHeaders =
  | { get(name: string): string | null }
  | Readonly<Record<string, string | readonly string[] | undefined>>;
