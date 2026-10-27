import { createHash } from 'node:crypto';
import { LigueLeadWebhookParseError } from '../Errors/LigueLeadWebhookParseError';
import { Json } from '../Support/Json';
import type {
  CampaignStatusEventBody,
  KnownWebhookEventBody,
  RcsAgentStatusEventBody,
  RcsCampaignStatusEventBody,
  RcsInboundPostbackEventBody,
  SmsCampaignStatusEventBody,
  SmsInboundEventBody,
  VoiceAiCampaignStatusEventBody,
  VoiceCampaignStatusEventBody,
  WebhookEventBody,
  WebhookHeaders,
} from '../Types/Webhooks';

/** What `parse` reads a body from: the raw request body, or an object already parsed. */
type RawWebhookBody = string | Uint8Array | object;

/**
 * A webhook the API sent.
 *
 * ```ts
 * const event = WebhookEvent.parse(req.body, req.headers);
 *
 * if (event.isSmsCampaignStatus()) {
 *   console.log(event.body.campaign.status);
 * } else if (!event.isKnown()) {
 *   // an event this SDK does not know yet: ignore it, never fail on it
 * }
 * ```
 *
 * Each `is*` method narrows the event itself, which TypeScript cannot do from the nested
 * `campaign.type`. Each checks the event's identity — name, channel, status, the id and phone it is
 * about, and the value it exists to carry — and not every field of it. The rest is typed after the
 * dispatcher's DTOs, which always write it: rejecting an event over a missing secondary field would
 * turn a real status into an "unknown" one that handlers ignore, and the API does not deliver it
 * again. A field the API adds later never makes an event be rejected, and a channel or an event the
 * SDK does not know is not recognized by any of them.
 *
 * There is no signature to verify: the API does not sign its webhooks. Authenticate the call with a
 * secret of your own in the `webhook_url` query string. Delivery is at least once — a notification
 * is sent again after a 5xx, 408, 425 or 429, a timeout, or a connection refused or not resolved, and
 * one can come again after a 2xx —, so deduplicate by `deliveryId`, or by `deliveryKey()` when the
 * request has no `X-LigueLead-Delivery-Id`.
 */
export class WebhookEvent<B extends WebhookEventBody = WebhookEventBody> {
  static readonly #CAMPAIGN_TYPES: ReadonlySet<unknown> = new Set([
    'sms',
    'sms_flash',
    'rcs_basic',
    'rcs_single',
    'voice',
    'voice_ai',
  ]);

  static readonly #DELIVERY_ID_HEADER = 'X-LigueLead-Delivery-Id';

  static readonly #DELIVERY_ATTEMPT_HEADER = 'X-LigueLead-Delivery-Attempt';

  /** The body as the API sent it. */
  readonly body: B;

  /**
   * The `X-LigueLead-Delivery-Id` header: identifies the notification, the same on every attempt of
   * it — the key to recognize a retry by. `undefined` when `parse` got no headers, or not this one.
   */
  readonly deliveryId: string | undefined;

  /**
   * The `X-LigueLead-Delivery-Attempt` header: `1` on the first attempt, counting up on each retry (a
   * number can repeat). `undefined` when `parse` got no headers, or not this one as a whole number.
   */
  readonly deliveryAttempt: number | undefined;

  /**
   * @param {B} body - A body whose envelope was checked.
   * @param {string | undefined} deliveryId - The `X-LigueLead-Delivery-Id` header, when it came.
   * @param {number | undefined} deliveryAttempt - The `X-LigueLead-Delivery-Attempt` header, when it came.
   */
  private constructor(
    body: B,
    deliveryId: string | undefined,
    deliveryAttempt: number | undefined,
  ) {
    this.body = body;
    this.deliveryId = deliveryId;
    this.deliveryAttempt = deliveryAttempt;
  }

  /**
   * Reads a webhook body.
   *
   * Accepts the raw body (a string or a `Buffer`, as `express.raw()` gives it) or an object already
   * parsed. Only the envelope is checked — `event`, `app_id` and `occurred_at` — and an event the
   * SDK does not know is returned as it came.
   *
   * A signature of its own, so `raws.map(WebhookEvent.parse)` keeps compiling: `map` passes the index
   * second, which the overload with headers would refuse — and which reads as no headers at run time.
   * `this: void` says `parse` can be passed unbound, as `map` does: it never reads `this`, and type-aware
   * lint (`@typescript-eslint/unbound-method`) need not flag that call.
   *
   * @param {string | Uint8Array | object} raw - The request body.
   *
   * @throws {LigueLeadWebhookParseError} When the body is not JSON or lacks the envelope.
   *
   * @returns {WebhookEvent} The event.
   */
  static parse(
    this: void,
    raw: RawWebhookBody,
  ): WebhookEvent;

  /**
   * Reads a webhook body and, when given, the request headers.
   *
   * The body as in the overload without headers. From the headers, only `X-LigueLead-Delivery-Id`
   * and `X-LigueLead-Delivery-Attempt` are read, into `deliveryId` and `deliveryAttempt`. Headers
   * that are `null` — an API Gateway console test sends them so — or not an object read as none; a
   * header missing or malformed leaves its field `undefined`. Neither ever fails the parse.
   *
   * `headers` is optional here too, and this overload has no `this: void`: `Parameters<>`,
   * `ThisParameterType<>` and `.bind`/`.call`/`.apply` read this last overload, and a wrapper typed
   * by it, or a bound `parse`, must still work as in 1.1.0. The first overload carries `this: void`,
   * which is the one `@typescript-eslint/unbound-method` reads.
   *
   * @param {string | Uint8Array | object} raw - The request body.
   * @param {WebhookHeaders | null} [headers] - The request headers: `req.headers`, or a Fetch
   *   `Headers`.
   *
   * @throws {LigueLeadWebhookParseError} When the body is not JSON or lacks the envelope.
   *
   * @returns {WebhookEvent} The event.
   */
  static parse(
    raw: RawWebhookBody,
    headers?: WebhookHeaders | null,
  ): WebhookEvent;

  /**
   * @param {string | Uint8Array | object} raw - The request body.
   * @param {WebhookHeaders | null} [headers] - The request headers.
   *
   * @throws {LigueLeadWebhookParseError} When the body is not JSON or lacks the envelope.
   *
   * @returns {WebhookEvent} The event.
   */
  static parse(
    this: void,
    raw: RawWebhookBody,
    headers?: WebhookHeaders | null,
  ): WebhookEvent {
    let value: unknown = raw;

    if (
      typeof raw === 'string'
      || raw instanceof Uint8Array
    ) {
      const text = typeof raw === 'string'
        ? raw
        : Buffer.from(raw).toString('utf8');

      try {
        value = JSON.parse(text);
      } catch (error) {
        throw new LigueLeadWebhookParseError(
          'The webhook body is not valid JSON',
          { cause: error },
        );
      }
    }

    if (
      !Json.isObject(value)
      || typeof value.event !== 'string'
      || value.event === ''
      || typeof value.app_id !== 'string'
      || typeof value.occurred_at !== 'string'
    ) {
      throw new LigueLeadWebhookParseError('The webhook body lacks the event envelope (event, app_id, occurred_at)');
    }

    return new WebhookEvent(
      value as WebhookEventBody,
      WebhookEvent.#header(
        headers,
        WebhookEvent.#DELIVERY_ID_HEADER,
      ),
      WebhookEvent.#attempt(WebhookEvent.#header(
        headers,
        WebhookEvent.#DELIVERY_ATTEMPT_HEADER,
      )),
    );
  }

  /**
   * The event name (`campaign.status`, `sms.inbound`, …).
   *
   * @returns {string} The value.
   */
  get name(): string {
    return this.body.event;
  }

  /**
   * The app the event belongs to; empty on an SMS reply that could not be matched to a send.
   *
   * @returns {string} The value.
   */
  get appId(): string {
    return this.body.app_id;
  }

  /**
   * When LigueLead issued this notification (ISO 8601, UTC) — not when the event happened. A retry
   * carries the same value; a second notification of the same status carries its own.
   *
   * @returns {string} The value.
   */
  get occurredAt(): string {
    return this.body.occurred_at;
  }

  /**
   * @returns {boolean} `true` for a `campaign.status` event of a channel the SDK knows.
   */
  isCampaignStatus(): this is WebhookEvent<CampaignStatusEventBody> {
    return this.#campaignType() !== undefined;
  }

  /**
   * @returns {boolean} `true` for a `campaign.status` event of an SMS or SMS Flash.
   */
  isSmsCampaignStatus(): this is WebhookEvent<SmsCampaignStatusEventBody> {
    const type = this.#campaignType();

    return type === 'sms' || type === 'sms_flash';
  }

  /**
   * @returns {boolean} `true` for a `campaign.status` event of an RCS message.
   */
  isRcsCampaignStatus(): this is WebhookEvent<RcsCampaignStatusEventBody> {
    const type = this.#campaignType();

    return type === 'rcs_basic' || type === 'rcs_single';
  }

  /**
   * @returns {boolean} `true` for a `campaign.status` event of a call with an uploaded audio.
   */
  isVoiceCampaignStatus(): this is WebhookEvent<VoiceCampaignStatusEventBody> {
    return this.#campaignType() === 'voice';
  }

  /**
   * @returns {boolean} `true` for a `campaign.status` event of a call by a voice agent.
   */
  isVoiceAiCampaignStatus(): this is WebhookEvent<VoiceAiCampaignStatusEventBody> {
    return this.#campaignType() === 'voice_ai';
  }

  /**
   * @returns {boolean} `true` for an `rcs.inbound.postback` event.
   */
  isRcsInboundPostback(): this is WebhookEvent<RcsInboundPostbackEventBody> {
    const body = this.#fields();

    if (
      body.event !== 'rcs.inbound.postback'
      || !WebhookEvent.#identifiesCampaign(body.campaign)
    ) {
      return false;
    }

    const {
      type,
      inbound,
    } = body.campaign;

    return (type === 'rcs_basic' || type === 'rcs_single')
      && Json.isObject(inbound)
      && inbound.type === 'postback'
      && typeof inbound.postback_data === 'string';
  }

  /**
   * @returns {boolean} `true` for an `sms.inbound` event.
   */
  isSmsInbound(): this is WebhookEvent<SmsInboundEventBody> {
    const body = this.#fields();

    // `campaign.id` may be empty — a reply that could not be matched to its send — but it is there.
    return body.event === 'sms.inbound'
      && WebhookEvent.#identifiesCampaign(body.campaign)
      && typeof body.campaign.message === 'string';
  }

  /**
   * @returns {boolean} `true` for an `rcs.agent.status` event.
   */
  isRcsAgentStatus(): this is WebhookEvent<RcsAgentStatusEventBody> {
    const body = this.#fields();

    return body.event === 'rcs.agent.status'
      && Json.isObject(body.agent)
      && typeof body.agent.id === 'string'
      && typeof body.agent.status === 'string'
      && (body.agent.rejection_reason === null || typeof body.agent.rejection_reason === 'string');
  }

  /**
   * @returns {boolean} `true` for any event this SDK knows.
   */
  isKnown(): this is WebhookEvent<KnownWebhookEventBody> {
    return this.isCampaignStatus() || this.isRcsInboundPostback() || this.isSmsInbound() || this.isRcsAgentStatus();
  }

  /**
   * A key for deduplication by content: a hash of the whole body except `occurred_at`. The headers
   * never enter it.
   *
   * A retry carries the same body, so it gets the same key. On a `campaign.status`, so does a second
   * notification of the same status (the provider reported it twice), which comes with its own
   * `deliveryId` and its own `occurred_at`. On the other events, equal content can be a new event,
   * and it gets the same key too: two "SIM" replies from the same phone (`sms.inbound`), the same
   * button tapped twice (`rcs.inbound.postback`), an agent back to `under_review`
   * (`rcs.agent.status`). Deduplicate by `deliveryId`, and use this key when the request had no
   * `X-LigueLead-Delivery-Id`, or to also drop a status that arrives twice. Keep the keys in a store
   * every instance shares, with an expiry.
   *
   * @returns {string} A SHA-256 hex digest.
   */
  deliveryKey(): string {
    const content = { ...this.#fields() };

    delete content.occurred_at;

    return createHash('sha256').update(JSON.stringify(content)).digest('hex');
  }

  /**
   * @returns {B} The body, so `JSON.stringify` of the event writes what the API sent.
   */
  toJSON(): B {
    return this.body;
  }

  #fields(): Record<string, unknown> {
    return this.body as unknown as Record<string, unknown>;
  }

  #campaignType(): unknown {
    const body = this.#fields();

    if (
      body.event !== 'campaign.status'
      || !WebhookEvent.#identifiesCampaign(body.campaign)
      || typeof body.campaign.status !== 'string'
    ) {
      return undefined;
    }

    return WebhookEvent.#CAMPAIGN_TYPES.has(body.campaign.type)
      ? body.campaign.type
      : undefined;
  }

  static #identifiesCampaign(campaign: unknown): campaign is Record<string, unknown> {
    return Json.isObject(campaign) && typeof campaign.id === 'string' && typeof campaign.phone === 'string';
  }

  /**
   * One header, by name without regard to case: its first value, trimmed, or `undefined` when it is
   * absent or blank. A Fetch `Headers` matches the case itself; a plain object is searched, because
   * Node lowercases the names it gives while an API Gateway REST event keeps the sender's case.
   *
   * The first value of an array, and the first comma-separated part of a string: Node's `req.headers`
   * and a Fetch `Headers` join a repeated header with ", ". The API never repeats these two, and
   * neither value can hold a comma — the id is a UUID, the attempt a number.
   *
   * @param {WebhookHeaders | null | undefined} headers - The request headers; anything but an object
   *   (`null`, or the index `Array.prototype.map` passes) reads as none.
   * @param {string} name - The header.
   *
   * @returns {string | undefined} The value.
   */
  static #header(
    headers: WebhookHeaders | null | undefined,
    name: string,
  ): string | undefined {
    if (
      typeof headers !== 'object'
      || headers === null
    ) {
      return undefined;
    }

    let value: unknown;

    if (typeof headers.get === 'function') {
      value = headers.get(name);
    } else {
      const wanted = name.toLowerCase();
      const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === wanted);

      value = key === undefined
        ? undefined
        : (headers as Readonly<Record<string, unknown>>)[key];
    }

    const first: unknown = Array.isArray(value)
      ? value[0]
      : value;

    if (typeof first !== 'string') {
      return undefined;
    }

    const comma = first.indexOf(',');

    const part = (comma === -1
      ? first
      : first.slice(
          0,
          comma,
        )).trim();

    return part === ''
      ? undefined
      : part;
  }

  /**
   * @param {string | undefined} value - The `X-LigueLead-Delivery-Attempt` header.
   *
   * @returns {number | undefined} The attempt, when the header is a whole number of 1 or more.
   */
  static #attempt(value: string | undefined): number | undefined {
    if (
      value === undefined
      || !/^\d+$/.test(value)
    ) {
      return undefined;
    }

    const attempt = Number(value);

    return Number.isSafeInteger(attempt) && attempt >= 1
      ? attempt
      : undefined;
  }
}
