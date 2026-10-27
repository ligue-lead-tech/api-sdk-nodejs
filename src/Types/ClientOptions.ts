import type { Agent as HttpAgent } from 'node:http';
import type { Agent as HttpsAgent } from 'node:https';

/**
 * Where the client points:
 * - `production` — `https://api.liguelead.com.br/v1`;
 * - `staging` — `https://homolog-api.liguelead.com.br/v1`, the homologation stack;
 * - `development` — `http://localhost:3008/v1`, the API running locally;
 * - `testing` — no fixed URL: pass `baseUrl` (a mock server, or the API running locally), so a test
 *   never reaches a real environment by default.
 *
 * There is no sandbox.
 */
export type Environment = 'production' | 'staging' | 'development' | 'testing';

/** Options of `LigueLeadClient`. */
export interface LigueLeadClientOptions {
  /** API token, generated in the client area. Sent as `api-token`. */
  apiToken: string;
  /**
   * App id, sent as `app-id`. Required by every route except `/apps`, which is how the first app
   * gets created. A call to an app-scoped route without it fails before reaching the network.
   */
  appId?: string | undefined;
  /**
   * Environment to call. Defaults to `production`. Ignored when `baseUrl` is given; `testing` has no
   * URL of its own and requires `baseUrl`.
   */
  environment?: Environment | undefined;
  /** Base URL including `/v1`, overriding `environment` (a local API, a proxy). */
  baseUrl?: string | undefined;
  /** Per-attempt timeout in milliseconds. Defaults to `ClientOptions.DEFAULT_TIMEOUT_MS`. */
  timeoutMs?: number | undefined;
  /** Retries of a GET on a network error, 429 or 5xx. Defaults to `ClientOptions.DEFAULT_MAX_RETRIES`. */
  maxRetries?: number | undefined;
  /**
   * Value of the `source` header, which the API echoes back as `campaign.source` in webhooks and
   * keeps with each campaign. Not sent when omitted, so the server records its default, `api`.
   */
  source?: string | undefined;
  /** Agent for `http:` base URLs. */
  httpAgent?: HttpAgent | undefined;
  /**
   * Agent for `https:` base URLs. High-volume senders should pass one with `keepAlive: true`;
   * Node 18's default agent opens a new connection per request.
   */
  httpsAgent?: HttpsAgent | undefined;
}

/** Per-call options, accepted as the last argument of every method. */
export interface RequestOptions {
  /** Cancels the call, including the wait between retries. */
  signal?: AbortSignal | undefined;
  /** Overrides the client's `timeoutMs` for this call. */
  timeoutMs?: number | undefined;
  /** Overrides the client's `maxRetries` for this call. Has no effect on a non-GET. */
  maxRetries?: number | undefined;
}
