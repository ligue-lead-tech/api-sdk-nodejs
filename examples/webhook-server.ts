/**
 * Receives LigueLead webhooks with nothing but `node:http`.
 *
 *   WEBHOOK_SECRET=... npx tsx examples/webhook-server.ts
 *
 * Point the app's webhook URL (or a send's `webhook_url`) at
 * `https://your-host/webhooks/ligue-lead?secret=<WEBHOOK_SECRET>`. The API does not sign its
 * webhooks, so the secret in the query string is what authenticates the call.
 */
import { timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage } from 'node:http';
import { LigueLeadWebhookParseError, WebhookEvent } from '@liguelead/api-sdk';

const secret = Buffer.from(process.env.WEBHOOK_SECRET ?? '');

/**
 * Delivery is at least once. A notification answered 5xx, 408, 425 or 429, or not answered within 60
 * seconds, is sent again — up to 8 attempts, the last about 36 to 49 minutes after the first —, and
 * one can come again even after a 2xx. Every attempt carries the same `X-LigueLead-Delivery-Id`
 * (`event.deliveryId`): deduplicate by it, and by `event.deliveryKey()` when a request lacks it.
 *
 * This dedupe is the example's, not production's: it lives in one process, forgets on restart and
 * keeps the latest 10000 deliveries. A real receiver needs a store every instance shares, with an
 * expiry — a Redis `SET key NX EX 86400` on that key, or a unique index.
 */
const MAX_REMEMBERED = 10_000;
const remembered = new Set<string>();

function firstDelivery(key: string): boolean {
  if (remembered.has(key)) {
    return false;
  }

  remembered.add(key);

  if (remembered.size > MAX_REMEMBERED) {
    const [oldest] = remembered;

    if (oldest !== undefined) {
      remembered.delete(oldest);
    }
  }

  return true;
}

function authorized(request: IncomingMessage): boolean {
  const given = Buffer.from(new URL(request.url ?? '/', 'http://localhost').searchParams.get('secret') ?? '');

  return secret.length > 0 && given.length === secret.length && timingSafeEqual(given, secret);
}

async function readBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(chunk as Buffer);
  }

  return Buffer.concat(chunks);
}

function handle(event: WebhookEvent): void {
  if (event.isSmsCampaignStatus()) {
    console.log(`SMS ${event.body.campaign.id} to ${event.body.campaign.phone}: ${String(event.body.campaign.status)}`);
  } else if (event.isVoiceAiCampaignStatus()) {
    console.log(`AI call ${event.body.campaign.id}: ${String(event.body.campaign.status)}, action ${String(event.body.campaign.action_executed)}`);
  } else if (event.isRcsInboundPostback()) {
    console.log(`RCS button ${event.body.campaign.inbound.postback_data} from ${event.body.campaign.phone}`);
  } else if (event.isSmsInbound()) {
    console.log(`SMS reply from ${event.body.campaign.phone}: ${event.body.campaign.message}`);
  } else if (event.isRcsAgentStatus()) {
    console.log(`RCS agent ${event.body.agent.id}: ${String(event.body.agent.status)}`);
  } else {
    // An event this SDK does not know yet: ignore it, never fail on it.
    console.log(`ignored ${event.name}`);
  }
}

const server = createServer((request, response) => {
  void (async () => {
    if (request.method !== 'POST' || !authorized(request)) {
      response.writeHead(401).end();
      return;
    }

    try {
      const event = WebhookEvent.parse(await readBody(request), request.headers);

      // Answer first: after 60 seconds the attempt counts as failed and the event is sent again. A
      // 2xx is final, so a production receiver stores the event durably before answering — here it
      // lives only in memory, and a restart loses it.
      response.writeHead(204).end();

      if (firstDelivery(event.deliveryId ?? event.deliveryKey())) {
        handle(event);
      }
    } catch (error) {
      if (!response.headersSent) {
        // A body that cannot be read fails the same way on every attempt: a 400 ends them. Anything
        // else answers 500, which the API retries.
        response.writeHead(error instanceof LigueLeadWebhookParseError ? 400 : 500).end();
      }
    }
  })();
});

server.listen(3000, () => {
  console.log('listening on :3000');
});
