import type { OpenEnum } from './Shared';

/** Credentials of a Microsoft 365 app registration. */
export interface MicrosoftCredentials {
  tenant: string;
  client_id: string;
  client_secret: string;
}

/** Credentials of a Google OAuth client. */
export interface GoogleCredentials {
  client_id: string;
  client_secret: string;
  refresh_token: string;
}

/** Where `SCHEDULE_EVENT` books the meeting. */
export interface ScheduleEventConfig {
  /** Email of the calendar owner. */
  destination: string;
  calendar_id?: string;
  /** IANA time zone (`America/Sao_Paulo`). */
  timezone?: string;
}

/** Who sends and who receives the `SEND_EMAIL` message. */
export interface SendEmailConfig {
  from_address: string;
  destination: string;
}

/** Books a meeting in the caller's calendar. */
export type ScheduleEventActionParams =
  | {
    name: string;
    type: 'SCHEDULE_EVENT';
    provider: 'microsoft';
    credentials: MicrosoftCredentials;
    config: ScheduleEventConfig
  }
  | {
    name: string;
    type: 'SCHEDULE_EVENT';
    provider: 'google';
    credentials: GoogleCredentials;
    config: ScheduleEventConfig
  };

/** Sends an email. */
export type SendEmailActionParams =
  | {
    name: string;
    type: 'SEND_EMAIL';
    provider: 'microsoft';
    credentials: MicrosoftCredentials;
    config: SendEmailConfig
  }
  | {
    name: string;
    type: 'SEND_EMAIL';
    provider: 'google';
    credentials: GoogleCredentials;
    config: SendEmailConfig
  };

/** Sends an SMS to the person on the call. */
export interface SendSmsActionParams {
  name: string;
  type: 'SEND_SMS';
  provider: 'internal';
  /** 1 to 1600 characters; blocked words are refused. */
  message: string;
}

/** Transfers the call to a phone. */
export interface TransferCallActionParams {
  name: string;
  type: 'TRANSFER_CALL';
  provider: 'internal';
  /** 10 to 16 digits. */
  phone: string;
}

/** POSTs to an endpoint of yours. */
export interface HttpWebhookActionParams {
  name: string;
  type: 'HTTP_WEBHOOK';
  provider: 'internal';
  /** An `https://` URL, up to 2048 characters. */
  endpoint: string;
  /** Sent to the endpoint so it can authenticate the call, up to 2048 characters. */
  authorization_token?: string;
}

/**
 * Body of `voiceActions.create`: `type` and `provider` decide which fields the action takes. Every
 * name is 1 to 100 characters.
 */
export type VoiceActionCreateParams =
  | ScheduleEventActionParams
  | SendEmailActionParams
  | SendSmsActionParams
  | TransferCallActionParams
  | HttpWebhookActionParams;

/** The fields of a voice action that `voiceActions.update` can change. */
export interface VoiceActionUpdateFields {
  name?: string;
  /**
   * Replaces the stored `config` as a whole: send every key, because a key left out is removed —
   * required ones such as `destination` included.
   */
  config?: Partial<ScheduleEventConfig & SendEmailConfig>;
  credentials?: MicrosoftCredentials | GoogleCredentials;
  phone?: string;
  endpoint?: string;
  authorization_token?: string;
  message?: string;
}

/**
 * Body of `voiceActions.update`: the fields to change — at least one, which the type enforces (the
 * API refuses an empty body with a 422). `type` and `provider` cannot change.
 */
export type VoiceActionUpdateParams = {
  [K in keyof VoiceActionUpdateFields]-?: Required<Pick<VoiceActionUpdateFields, K>> & Omit<VoiceActionUpdateFields, K>;
}[keyof VoiceActionUpdateFields];

/** Kinds of voice action. */
export type VoiceActionType = OpenEnum<'SCHEDULE_EVENT' | 'SEND_EMAIL' | 'SEND_SMS' | 'TRANSFER_CALL' | 'HTTP_WEBHOOK'>;

/**
 * A voice action, as stored.
 *
 * It carries the credentials and the `authorization_token` as given — treat it as a secret, and
 * keep it out of logs.
 */
export interface VoiceAction {
  /** The action id, sent as a voice agent's `action_id`. */
  id: string;
  name: string;
  type: VoiceActionType;
  provider: OpenEnum<'microsoft' | 'google' | 'internal'>;
  credentials?: MicrosoftCredentials | GoogleCredentials;
  config?: Partial<ScheduleEventConfig & SendEmailConfig>;
  phone?: string;
  endpoint?: string;
  authorization_token?: string;
  message?: string;
}
