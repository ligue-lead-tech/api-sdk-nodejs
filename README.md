# @liguelead/api-sdk

Node.js + TypeScript SDK for the LigueLead API: SMS, voice, RCS and AI voice campaigns.

It covers the public LigueLead API at `https://api.liguelead.com.br/v1`: campaign sends and
recipients, audio files, RCS agents and templates, voice agents and actions, apps, and the types of
the webhooks the API sends. The API reference and guides are at
[docs.liguelead.com.br](https://docs.liguelead.com.br/).

## Installation

```bash
npm install @liguelead/api-sdk
```

Requires Node.js 18.18 or later.

## Usage

```ts
import { LigueLeadClient } from '@liguelead/api-sdk';

const client = new LigueLeadClient({
  apiToken: process.env.LIGUELEAD_API_TOKEN!,
  appId: process.env.LIGUELEAD_APP_ID,
});

const { campaign_id } = await client.campaigns.sms.send({
  message: 'Olá! Seu pedido saiu para entrega.',
  phones: ['11999999999'],
});
```

Whatever creates or queries a campaign lives under `client.campaigns`, one sub-resource per channel
(`sms`, `voice`, `rcs`, `voiceAi`), named after the webhooks' `campaign.type` in camelCase —
`voiceAi` is the webhooks' `voice_ai`; there is no `client.campaigns.voice_ai`. The registrations
that campaigns reuse live at the top level, per channel:

| Resource | Routes |
|---|---|
| `client.campaigns.sms` / `.voice` / `.rcs` / `.voiceAi` | `POST /v1/sms`, `/v1/voice`, `/v1/rcs`, `/v1/voice-agent/call` |
| `client.campaigns.recipients` | `GET /v1/campaigns/{id}/recipients` |
| `client.voice.uploads` | `/v1/voice/uploads` |
| `client.rcs.agents` / `client.rcs.templates` | `/v1/rcs/agents`, `/v1/rcs/templates` |
| `client.voiceAgents` / `client.voiceActions` | `/v1/voice-agent`, `/v1/voice-action` |
| `client.apps` | `/v1/apps` |

### Options

| Option | Default | |
|---|---|---|
| `apiToken` | — | API token, generated in the Área do Cliente (client area). Sent as `api-token`. |
| `appId` | — | App id, sent as `app-id`. Every route requires it except `/apps`; without it the call fails before it leaves. |
| `environment` | `production` | `production` (`https://api.liguelead.com.br/v1`), `staging` (`https://homolog-api.liguelead.com.br/v1`, the homologation environment), `development` (`http://localhost:3008/v1`, the API running locally) or `testing` (no URL of its own: it requires `baseUrl`, so that a test never falls through to a real environment by default). There is no sandbox. |
| `baseUrl` | — | Base URL including `/v1`, used instead of `environment` (local API, proxy). |
| `timeoutMs` | `30000` | Timeout per attempt. It sits above API Gateway's 29 s limit, so that the gateway's 504 arrives first. |
| `maxRetries` | `2` | Retries of a GET. Other methods are never repeated — see below. |
| `source` | — | `source` header, which the API stores with the campaign and returns as `campaign.source` in the webhook. Without it, the API records `api`. |
| `httpAgent` / `httpsAgent` | — | HTTP agents. For high volume, pass an `https.Agent` with `keepAlive: true`. |

Every method accepts, as its last argument, `{ signal, timeoutMs, maxRetries }` for that call.

`client.withOptions({ ... })` returns a client with some options swapped — another app of the same
customer, another `source` — without changing the original:

```ts
const otherApp = client.withOptions({ appId: 'f3a1…' });
```

The token is kept in private fields: `console.log(client)` and `JSON.stringify(client)` do not show it.

### Campaigns — `client.campaigns`

Every send returns `{ campaign_id, accepted_at }`: the API validates, enqueues and responds; delivery
comes later, through the webhook and through `campaigns.recipients`. Credit is checked after the
response: without balance, the campaign is still accepted, and the recipients end up as
`insufficient_credits`: in SMS only `campaigns.recipients` shows it (the SMS webhook only emits
`delivered`); in RCS and voice it arrives by webhook, as the only status those phones get.

```ts
// SMS (up to 10000 numbers per request; SMS Flash with is_flash: true)
await client.campaigns.sms.send({
  message: 'Seu código é 1234',
  phones: ['11999999999', '+5511888888888'],
  webhook_url: 'https://minha-api.com.br/webhooks/ligue-lead?secret=…',
});

// Voice, with an audio file uploaded beforehand through client.voice.uploads
await client.campaigns.voice.send({
  title: 'Lembrete de consulta',
  voice_upload_id: 436514,
  phones: ['11999999999'],
  retry_attempts: 2,
  retry_interval_min: 30,
});

// RCS: free text through an approved agent of the app…
await client.campaigns.rcs.send({ phones: ['11999999999'], agent_id: '7b3c1e90-…', message: 'Olá!' });
// …or a template (the agent comes from the template)
await client.campaigns.rcs.send({
  phones: ['11999999999'],
  template_id: 'tmpl_2X8…',
  template_variables: [{ key: '1', value: 'Maria' }],
});
```

The types do not let you mix `message` with `template_id`, nor send `agent_id` with a template. The
send's `webhook_url` receives only the `campaign.status` events of that campaign, for 7 days; replies
and postbacks keep going to the app's URL.

**Recipients** of SMS and SMS Flash campaigns are available for 72 hours. Right after the send, the
campaign may not have been stored yet: a 404 in the first few seconds means "not yet".

```ts
const page = await client.campaigns.recipients.list(campaign_id, { limit: 100 });
const one = await client.campaigns.recipients.list(campaign_id, { phone: '11999999999' });

for await (const recipient of client.campaigns.recipients.iterate(campaign_id)) {
  console.log(recipient.phone, recipient.status); // delivered, unreachable, opt_out, …
}
```

### Audio files — `client.voice.uploads`

```ts
const audio = await client.voice.uploads.create({ title: 'Boas-vindas', file: './boas-vindas.mp3' });
await client.campaigns.voice.send({ title: 'Boas-vindas', voice_upload_id: audio.id, phones: ['11999999999'] });

const audios = await client.voice.uploads.list(); // the 100 most recent
const same = await client.voice.uploads.get(audio.id);
```

`file` accepts a path, a `File` (or a `Blob` with `name`) or `{ data, filename }` — `data` can be a
`Buffer`, `Uint8Array`, `ArrayBuffer`, `Blob` or a stream. The name is mandatory because the API
decides by the extension: only `.wav` and `.mp3`, up to 5 MB. The file's content type is derived from
the extension (the API refuses `audio/x-wav`, which many tools put on a `.wav`).

### RCS — `client.rcs.agents` and `client.rcs.templates`

The **agent** is the brand that RCS messages are sent under. Each app has at most one, and it only
sends after it is approved. The review result arrives as an `rcs.agent.status` event at the agent's
own `webhook_url`.

```ts
const agent = await client.rcs.agents.create({
  use_case: 'promotional', // otp | transactional | promotional; cannot change after approval
  sender_name: 'Loja Exemplo',
  sender_description: 'Ofertas e avisos de pedidos',
  brand_color: '#FF6600',
  logo_url: 'https://cdn.exemplo.com.br/logo.png',
  banner_url: 'https://cdn.exemplo.com.br/banner.png',
  // …contact, company, websites, privacy and terms: all required
  webhook_url: 'https://minha-api.com.br/webhooks/rcs-agent',
});

const agents = await client.rcs.agents.list(); // from every app of the customer
// update is a replacement: start from the current agent, without the fields only the API writes
const { id, app_id, status, rejection_reason, use_case, ...current } = await client.rcs.agents.get(agent.id);
await client.rcs.agents.update(agent.id, { ...current, sender_name: 'Loja Exemplo Oficial' }); // resubmits for review
await client.rcs.agents.delete(agent.id); // 409 if already approved
```

`update` is a full replacement: every brand field is required, as on creation; `webhook_url` and
`test_devices` left out are erased; `use_case` left out is kept.

The **template** belongs to an agent and is sent with `campaigns.rcs.send({ template_id })`. The
`fallback_message` is the SMS that goes out when the RCS message is not delivered.

```ts
import { readFile } from 'node:fs/promises';
import { DataUri } from '@liguelead/api-sdk';

await client.rcs.templates.createText({
  agent_id: agent.id,
  title: 'Código de acesso',
  body: 'Olá {{1}}, seu código é {{2}}',
  default_variables: [{ key: '1', value: 'Cliente' }],
  fallback_message: 'Seu código de acesso chegou. Abra o app para ver.',
});

await client.rcs.templates.createCard({
  agent_id: agent.id,
  title: 'Oferta',
  header: 'Só hoje',
  body: '20% em toda a loja',
  media_file: DataUri.fromBytes(await readFile('banner.png'), 'image/png'), // or media_url: 'https://…'
  buttons: [
    { type: 'reply', title: 'Quero', postback_data: 'QUERO' },      // comes back as rcs.inbound.postback
    { type: 'open_url', title: 'Ver', url: 'https://loja.exemplo.com.br' },
    { type: 'dial_call', title: 'Ligar', phone_number: '+5511987654321' },
  ],
});

const templates = await client.rcs.templates.list();
```

There is also `createMedia` (header, body and one media item) and `createCarousel` (2 to 10 cards,
all with the same number and type of buttons). The types do not let `media_url` and `media_file`
through together. The media in `media_file` travels inside the JSON, a third larger than the file,
and the request goes through API Gateway and Lambda, which cap the body at around 6 MB: for large
media, host the file and use `media_url`.

### AI voice — `client.voiceAgents`, `client.voiceActions` and `campaigns.voiceAi`

The **voice agent** holds the prompt, the engine and the voice of the calls. The valid voices of each
engine come from `listVoices`:

```ts
const { engines } = await client.voiceAgents.listVoices();
const lumen = engines.find((engine) => engine.version === 'lumen-1')!;

const agent = await client.voiceAgents.create({
  name: 'Lembrete de consulta',
  prompt: 'Você liga para lembrar o paciente da consulta e confirma a presença.',
  greetings: 'Olá! Aqui é da Clínica Exemplo.',
  engine: { version: 'lumen-1', voice_id: lumen.voices[0].id },
});
```

The prompt limit depends on the engine (2000 characters on `lumen-mini`, 25000 on `lumen-1`, 35000 on
`prisma-1` and `horizon-1`), and `stability`, `similarity_boost` and `speed` only apply to the
`lumen-*` engines. `update` replaces the whole agent. The API has no route to delete an agent.

The **voice action** is what the agent can do during the call — `SCHEDULE_EVENT` and `SEND_EMAIL`
(Microsoft or Google), `SEND_SMS`, `TRANSFER_CALL` and `HTTP_WEBHOOK` —, attached to the agent through
`action_id`. The response carries the credentials as they were stored: do not log it.

```ts
const action = await client.voiceActions.create({
  name: 'Registrar no CRM',
  type: 'HTTP_WEBHOOK',
  provider: 'internal',
  endpoint: 'https://crm.exemplo.com.br/ligacoes',
  authorization_token: process.env.CRM_TOKEN,
});

// update is a replacement: start from the current agent, without the fields only the API writes
const { id, app_id, created_at, updated_at, ...current } = await client.voiceAgents.get(agent.id);
await client.voiceAgents.update(agent.id, { ...current, action_id: action.id });
```

The **call** goes out through `campaigns.voiceAi.send`, up to 1000 numbers, each with its own
`call_context`:

```ts
const { campaign_id, phones_count } = await client.campaigns.voiceAi.send({
  title: 'Lembretes de amanhã',
  voice_agent_id: agent.id,
  phones: [
    '11999999999',
    { phone: '11888888888', call_context: 'Nome: Maria; consulta às 14h com Dr. João' },
  ],
});
```

### Apps — `client.apps`

The app routes authenticate with the token alone, so they work on a client without `appId` — that is
how the first app is created.

```ts
const app = await client.apps.create({ name: 'Integração ERP' }); // 409 if the name already exists
const apps = await client.apps.list();
await client.apps.delete(app.id); // deactivates; the history remains
```

## Webhooks

The API notifies by POST to the app's webhook URL (configured in the client area) or to the send's
`webhook_url`. The SDK types the events and reads the body:

```ts
import { WebhookEvent } from '@liguelead/api-sdk';

app.post('/webhooks/ligue-lead', express.raw({ type: 'application/json' }), (req, res) => {
  // body: string, Buffer or an already parsed object; headers: optional, for event.deliveryId
  const event = WebhookEvent.parse(req.body, req.headers);
  // In production, store the event durably (a queue, a table) before the 204 and process it from
  // there — see below. This sketch handles it in memory, which a restart loses.
  res.sendStatus(204); // respond right away, within 60 seconds

  if (event.isSmsCampaignStatus()) {
    console.log(event.body.campaign.id, event.body.campaign.status);
  } else if (event.isVoiceAiCampaignStatus()) {
    console.log(event.body.campaign.action_executed, event.body.campaign.transcript);
  } else if (event.isRcsInboundPostback()) {
    console.log(event.body.campaign.inbound.postback_data);
  }
  // unknown event (event.isKnown() === false): ignore it, never fail because of it
});
```

| Event | When | Goes to |
|---|---|---|
| `campaign.status` | a recipient's status changed; `campaign.type` tells the channel (`sms`, `sms_flash`, `rcs_basic`, `rcs_single`, `voice`, `voice_ai`) | the send's `webhook_url`, or the app's URL |
| `rcs.inbound.postback` | the recipient tapped a `reply` button on a card | app's URL |
| `sms.inbound` | the recipient replied to an SMS | app's URL |
| `rcs.agent.status` | an RCS agent's review moved (`under_review`, `approved`, `rejected`) | the agent's `webhook_url` |

The methods `isCampaignStatus()`, `isSmsCampaignStatus()`, `isRcsCampaignStatus()`,
`isVoiceCampaignStatus()`, `isVoiceAiCampaignStatus()`, `isRcsInboundPostback()`, `isSmsInbound()`,
`isRcsAgentStatus()` and `isKnown()` narrow the type of the event itself. Each one checks what its
type promises to read and nothing more: a new field from the API does not make an event be refused,
and a channel or event the SDK does not know is recognized by none of them. `event.name`,
`event.appId` and `event.occurredAt` give the envelope; `event.body` is the body as the API sent it.
Given the request headers, `parse` also reads `event.deliveryId` and `event.deliveryAttempt` from the
`X-LigueLead-Delivery-Id` and `X-LigueLead-Delivery-Attempt` headers (`undefined` when absent). It
takes Node's `req.headers` (`node:http`, Express), any plain object of headers — matched without
regard to case, as an API Gateway event brings them — or a Fetch `Headers`; `null` reads as no
headers, and a repeated header counts by its first value. Not a `Map`, whose `get` matches case.

What the receiver needs to know about delivery (the API's side is in the "Retries" section of
[How to Receive Webhooks](https://docs.liguelead.com.br/docs/how-to-receive-webhooks#retries)):

- **There is no signature.** Authenticate with a secret of your own in the URL's query string
  (`…/webhooks/ligue-lead?secret=…`), compared with `crypto.timingSafeEqual`.
- **Some failures are retried, for 36 to 49 minutes.** These get the notification sent again: an
  answer of `5xx`, `408`, `425` or `429`; no answer within 60 seconds; a connection refused, reset or
  unreachable; a hostname that does not resolve. Up to 8 attempts, waiting 30 s, 1, 2, 4, 8, 15 and
  15 min between them — each varied by up to 20%, stretched to the `Retry-After` of a `429` or `503`,
  never above 15 min. The eighth attempt therefore starts about 36 to 49 minutes after the first
  (later when attempts time out, and up to 105 min when every answer asks `Retry-After: 900`): plan for
  the floor, since an outage longer than about 36 minutes can lose notifications.
- **The others drop the notification at the first attempt:** any other `4xx`; a `3xx` from a send's
  `webhook_url`, whose redirects are not followed; a TLS failure (an expired or self-signed
  certificate, a name that does not match); a send's `webhook_url` that now resolves to a private
  address; and any failure the dispatcher cannot classify. The eighth failure drops it too. Answer
  `4xx` only for what you never want to receive, and `2xx` for an event you do not know.
- **Store, answer 2xx, then process.** A `2xx` ends the retries, so what is only in memory when you
  answer is lost if the process restarts: persist the event (a queue, a table) first. A request still
  open after 60 seconds is a failed attempt, and the notification comes again even if you processed it.
- **Delivery is at least once.** A retry is the same notification sent again, and one can arrive after
  your `2xx` when the answer did not reach the API in time. Deduplicate by `event.deliveryId`: the
  `X-LigueLead-Delivery-Id`, the same on every attempt. When the request has no such header, use
  `event.deliveryKey()`: the hash of the body **without** `occurred_at`. Outside `campaign.status`,
  that hash also merges real repeats with equal content — two "SIM" replies from the same phone, a
  button tapped twice, an RCS agent back to `under_review` —, so it is only the fallback there. A
  status the provider reported twice is a new notification, with its own delivery id and its own
  `occurred_at`; if processing it twice matters, `deliveryKey()` recognizes it too. `campaign.id` alone
  is not enough: a campaign has one event per recipient and per status, and `sms.inbound` may come
  without an id. Keep the keys in a store shared across instances, with expiry.
- **Upgrading from 1.1 or earlier,** where the key was `deliveryKey()` alone: a retry that spans the
  deploy was stored under its hash and is looked up by its delivery id. For one expiry period after
  the switch, check both keys before processing.
- **Order:** a retried notification can arrive after a later one for the same recipient — an RCS
  `delivered` after the `read` that followed it. Order by `occurred_at`, and do not let an older status
  overwrite a newer one.
- **SMS statuses:** today SMS only emits `delivered`. Handle `sent`, `undelivered` and `failed` as
  well; the types accept new values without breaking.
- **Dates:** `occurred_at` is when LigueLead issued the notification (UTC), not when the event
  happened; a retry carries the same value.
  `sent_at` comes with the São Paulo offset for SMS, SMS Flash and RCS (or as a date alone on older
  campaigns) and in UTC for voice and voice AI; on `insufficient_credits` it is when the send was due
  to go out. Parse it as ISO 8601 instead of slicing the string — except a date alone, which has no
  time: `new Date()` reads it as UTC midnight, the evening before in São Paulo; take it as that day.

The complete example, using only `node:http`, is in `examples/webhook-server.ts`.

## Errors

Every SDK error extends `LigueLeadError`. The API's message arrives as it came — including in
Portuguese, like the blocked-words one (`Mensagem contém palavras proibidas: …`).

| Class | When |
|---|---|
| `LigueLeadValidationError` | 422. `fieldErrors` lists `{ field, message }` when the schema refused; a business rule comes as a single message. |
| `LigueLeadAuthenticationError` | 401. Never retried: the API blocks an invalid token for 1 hour. |
| `LigueLeadNotFoundError` | 404. `routeNotFound: true` when the route itself does not exist — a sign that the SDK and the API have drifted apart. |
| `LigueLeadConflictError` | 409. |
| `LigueLeadBadRequestError`, `LigueLeadPayloadTooLargeError`, `LigueLeadUnsupportedMediaTypeError` | 400, 413, 415. |
| `LigueLeadRateLimitError` | 429 from API Gateway; `retryAfterMs` when it provides one. |
| `LigueLeadServerError` | 5xx. |
| `LigueLeadApiError` | Base of the above, and any other status. Carries `status`, `method`, `path`, `body`. |
| `LigueLeadConnectionError` / `LigueLeadTimeoutError` | No response: network, DNS, timeout. |
| `LigueLeadAbortError` | The call's `signal` aborted. |
| `LigueLeadConfigurationError`, `LigueLeadInvalidArgumentError` | SDK misuse: invalid option, missing `appId`, empty id. Thrown before any request. |
| `LigueLeadUnexpectedResponseError` | The API answered 2xx in a shape the SDK cannot read. |

```ts
import { LigueLeadValidationError } from '@liguelead/api-sdk';

try {
  await client.apps.create({ name: '' });
} catch (error) {
  if (error instanceof LigueLeadValidationError) {
    console.log(error.fieldErrors); // [{ field: 'name', message: 'Name is required' }]
  }
}
```

## Retries and idempotency

The API **has no idempotency key**: repeating a send creates another campaign, charged again. That is
why the SDK only retries **GET** — on network failure, timeout, 429 and 500/502/503/504, with
exponential backoff and jitter, honoring a `Retry-After` of up to 30 s. POST, PUT and DELETE go out
only once.

When a POST, PUT or DELETE fails with no response or with a 5xx, the error carries
`outcomeUnknown: true`: the request may have taken effect. Check before resending.

## Structure

The code is object-oriented: one class per file, named after the file, in PascalCase folders by role.
`Types/` holds only types (the API contract, with the wire names), and the `index.ts` files only
re-export.

| Folder | Classes |
|---|---|
| `src/` | `LigueLeadClient` |
| `Config/` | `ClientOptions` (validated options, defaults as static members), `SdkVersion` |
| `Client/` | `HttpClient`, `RetryPolicy`, `ErrorMapper`, `ApiPath`, `UploadFile`, `MultipartFormBuilder` |
| `Resources/` | `ApiResource` and one `*Resource` per route, in `Campaigns/`, `Voice/` and `Rcs/` |
| `Errors/` | `LigueLeadError` and one subclass per file |
| `Webhooks/` | `WebhookEvent` |
| `Support/` | `DataUri`, `Json` |

ESLint blocks more than one class per file (`max-classes-per-file`), and `npm run check:structure`
(also in CI) checks PascalCase and that every file outside `Types/` exports exactly the class of its
name. The tests mirror the same structure.

## Development

Development uses the Node version in `.nvmrc` (24, which nvm and `actions/setup-node` resolve to the latest
24.x): the lint toolchain (ESLint 10, `eslint-plugin-jsdoc` 65) needs Node 22.22.2+ or 24.15.0+. That is
separate from what the package supports at run time, `engines.node` (`>=18.18`), which the CI proves by
running the unit tests on Node 18, 20, 22 and 24.

```bash
npm ci
npm run lint        # ESLint (typescript-eslint strict, type-aware)
npm run test:tooling     # the lint rules' and the release scripts' own tests
npm run check:structure  # PascalCase and one class per file
npm run typecheck   # src, tests and examples
npm test            # unit tests, no network (nock)
npm run coverage    # unit tests with the 80% threshold on all four metrics
npm run build       # dist/ in CommonJS + .d.ts
npm run check:package
```

The integration tests (`npm run test:integration`) call a real LigueLead environment with
credentials from `.env` (see `.env.example`), and are run by the maintainers.

The examples in `examples/` run with `npx tsx examples/<file>.ts`.

To contribute, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Releases

From 1.3.1 on, each version is published to npm as `@liguelead/api-sdk`, with npm provenance, and
tagged `vX.Y.Z` here (1.3.0 is tagged, but never reached npm). `LigueLeadClient.VERSION` matches the version of the package. What changed in
each one is in the [CHANGELOG](CHANGELOG.md).

## License

[MIT](LICENSE). To report a security problem, see [SECURITY.md](SECURITY.md).
