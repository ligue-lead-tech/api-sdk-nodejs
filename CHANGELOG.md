# Changelog

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the version follows
[SemVer](https://semver.org/).

## [Unreleased]

## [1.3.0] — 2026-10-26

### Changed

- The SDK is open source under the [MIT license](LICENSE), and the package moves to npmjs as
  `@liguelead/api-sdk`: `npm install @liguelead/api-sdk`, with no `.npmrc` or token.
  Each release is published with npm provenance from the public repository
  [ligue-lead-tech/api-sdk-nodejs](https://github.com/ligue-lead-tech/api-sdk-nodejs), where its source
  arrives as one commit and a tag. The code is the same as `@ligue-lead-tech/api-sdk` on GitHub
  Packages, which gets no version after 1.2.1; only the name in `import`/`require` changes.
- The doc comments of `voiceActions.update` and of `VoiceActionUpdateFields.config` say what the API
  does: `config` is replaced as a whole, so send it complete — a key left out is removed, required
  ones such as `destination` included.

### Added

- Security problems are reported privately, as [SECURITY.md](SECURITY.md) describes.

## [1.2.1] — 2026-10-19

### Changed

- The doc comment of `RecipientStatus` keeps only that internal states never appear in it.
  The type is unchanged.

## [1.2.0] — 2026-10-17

### Added

- `WebhookEvent.parse(raw, headers?)` reads the delivery headers into `event.deliveryId`
  (`X-LigueLead-Delivery-Id`) and `event.deliveryAttempt` (`X-LigueLead-Delivery-Attempt`), both
  `undefined` without them.
  `headers` is Node's `req.headers`, any plain object of headers (matched without regard to case) or
  a Fetch `Headers`; the new `WebhookHeaders` type describes it. `null` reads as no headers, and a
  repeated header counts by its first value. A separate overload keeps `raws.map(WebhookEvent.parse)`
  compiling, `this: void` keeps `@typescript-eslint/unbound-method` quiet at that call, and
  `Parameters<typeof WebhookEvent.parse>` is `[raw, headers?]`, so a wrapper typed by it still
  takes the body alone. The id is the same on every attempt of a notification, and is the key to recognize a
  retry by. `deliveryKey()` is unchanged. Moving a receiver from `deliveryKey()` to
  `deliveryId ?? deliveryKey()`: for one expiry period, check both keys, or a retry that spans the
  deploy is processed twice.

### Fixed

- The README and `examples/webhook-server.ts` said the API never retries a webhook and that a
  response outside 2xx loses the event, and the docs of `occurred_at` and `deliveryKey()` said
  `occurred_at` changes on a redelivery.
  Since the API started retrying deliveries, a
  `5xx`, `408`, `425` or `429`, no answer within 60 seconds, a connection refused, reset or
  unreachable, or a hostname that does not resolve is retried — up to 8 attempts, the last about 36
  to 49 minutes after the first —, and every attempt carries the same body — `occurred_at`
  included — and the same delivery id. A TLS failure and any failure the dispatcher cannot classify
  are not retried. The example now deduplicates by `deliveryId`, falling back to `deliveryKey()`.

## [1.1.0] — 2026-10-17

### Added

- `insufficient_credits` in `RcsCampaignStatus` and `VoiceCampaignStatus`:
  the balance did not cover the message or the call, which was not sent and consumed no credit — the
  only status that phone gets. The API sends it for RCS, voice and voice with AI.

## [1.0.0] — 2026-10-07

Complete rewrite for the current LigueLead API.
Nothing of the previous interface was kept: it called routes the API no longer has, and the package
had never been published.

### Added

- `LigueLeadClient`, with the `production`, `staging`, `development` (local API) and `testing`
  (requires `baseUrl`) environments, optional `appId`, `withOptions`, `source`,
  and configurable timeout and HTTP agents.
- Campaigns in `client.campaigns`: `sms`, `voice`, `rcs` and `voiceAi` (`send`), and `recipients`
  (`list` and `iterate`, with cursor pagination).
- Registrations: `voice.uploads`, `rcs.agents`, `rcs.templates` (text, media, card and carousel),
  `voiceAgents` (with `listVoices`), `voiceActions` and `apps`.
- `WebhookEvent.parse` and the webhook types (`campaign.status` per channel,
  `rcs.inbound.postback`, `sms.inbound`, `rcs.agent.status`), with `is*()` methods that narrow the
  event and `deliveryKey()` for deduplication.
- `DataUri.fromBytes`, for the `media_file` of RCS templates.
- `ClientOptions`, with the environments and the defaults as static members, and `LigueLeadClient.VERSION`.
- Object-oriented structure: one class per file, in PascalCase, checked in CI.
- Errors typed by status (`LigueLeadValidationError` with `fieldErrors`,
  `LigueLeadAuthenticationError`, `LigueLeadNotFoundError`, …), by transport (`outcomeUnknown` when
  a send may have gone out) and by SDK misuse.
- Retries only on GET, with exponential backoff, jitter and `Retry-After`.
- Publishing to GitHub Packages, CommonJS + types, Node.js 18.18 or later.

### Removed

- `LigueleadSdk`, the `audio`, `message`, `voice` and `sms` services, and the old Models and Exceptions.
- The sandbox mode, which the API no longer has.
