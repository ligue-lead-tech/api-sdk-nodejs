/**
 * Compile-time checks of the webhook types, run by `npm run typecheck`.
 */
import type { IncomingHttpHeaders } from 'node:http';
import { WebhookEvent } from '@liguelead/api-sdk';

export function handle(raw: string): string | undefined {
  const event = WebhookEvent.parse(raw);

  if (event.isSmsCampaignStatus()) {
    return event.body.campaign.message;
  }

  if (event.isVoiceAiCampaignStatus()) {
    return event.body.campaign.transcript?.map((turn) => turn.content).join('\n');
  }

  if (event.isRcsInboundPostback()) {
    return event.body.campaign.inbound.postback_data;
  }

  // @ts-expect-error an unnarrowed event may be one the SDK does not know: no campaign is promised
  const campaignId = event.body.campaign.id;

  return typeof campaignId;
}

/** The headers of the usual servers are accepted as they come, and the delivery id is not promised. */
export function deliveryIds(
  raw: string,
  nodeHeaders: IncomingHttpHeaders,
  fetchHeaders: Headers,
  gatewayHeaders: Record<string, string | undefined>,
): (string | undefined)[] {
  const fromNode = WebhookEvent.parse(raw, nodeHeaders);
  const attempt: number | undefined = fromNode.deliveryAttempt;

  // @ts-expect-error the header may be absent: fall back to deliveryKey()
  const id: string = fromNode.deliveryId;

  return [
    id,
    String(attempt),
    fromNode.deliveryId ?? fromNode.deliveryKey(),
    WebhookEvent.parse(raw, fetchHeaders).deliveryId,
    WebhookEvent.parse(raw, gatewayHeaders).deliveryId,
    WebhookEvent.parse(raw, null).deliveryId,
  ];
}

/**
 * Passing `parse` to `map` compiled in 1.1.0, before the headers, and still does — without a lint
 * disable, since `parse` declares `this: void` and `@typescript-eslint/unbound-method` accepts it.
 */
export function parseAll(raws: string[]): WebhookEvent[] {
  return raws.map(WebhookEvent.parse);
}

/** A wrapper typed by `Parameters<>`, which reads the last overload, still takes the body alone. */
export function parseThrough(raw: string, headers: Headers): WebhookEvent[] {
  const wrapped = (...args: Parameters<typeof WebhookEvent.parse>): WebhookEvent => WebhookEvent.parse(...args);
  const bodyOnly: Parameters<typeof WebhookEvent.parse> = [raw];

  return [
    wrapped(raw),
    wrapped(raw, headers),
    wrapped(...bodyOnly),
  ];
}

/** A `Map` is refused: its `get` matches case, so lowercase keys would read as no header. */
export function mapHeaders(raw: string, headers: Map<string, string>): WebhookEvent {
  // @ts-expect-error a Map's get returns undefined, not the Fetch contract's null
  return WebhookEvent.parse(raw, headers);
}

// A bound `parse` works as in 1.1.0: `.bind`, `.call` and `.apply` read the last overload, which
// carries no `this: void`, and `map` over a bound `parse` still compiles.
export function parseBound(raw: string, raws: string[]): WebhookEvent[] {
  const parse = WebhookEvent.parse.bind(WebhookEvent);

  return [
    WebhookEvent.parse.call(WebhookEvent, raw),
    WebhookEvent.parse.apply(WebhookEvent, [raw]),
    ...raws.map((item) => parse(item)),
  ];
}
