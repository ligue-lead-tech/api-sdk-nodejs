import type { Agent as HttpAgent } from 'node:http';
import type { Agent as HttpsAgent } from 'node:https';
import { LigueLeadConfigurationError } from '../Errors/LigueLeadConfigurationError';
import type { Environment, LigueLeadClientOptions, RequestOptions } from '../Types/ClientOptions';

/**
 * The client's options, checked and with defaults applied.
 *
 * Built once per client; an invalid value fails here, at construction, rather than on the first
 * call. The token, the app id and the source live in private fields behind getters, so neither
 * `util.inspect` nor `JSON.stringify` of the options shows them.
 */
export class ClientOptions {
  /** Every environment the client accepts. */
  static readonly ENVIRONMENTS: readonly Environment[] = Object.freeze([
    'production',
    'staging',
    'development',
    'testing',
  ] as const);

  /**
   * Base URL of each environment that has one, including the `/v1` prefix. `testing` has none on
   * purpose: a test has to say where it points, so it never reaches a real environment by default.
   */
  static readonly ENVIRONMENT_BASE_URLS: Readonly<Record<Exclude<Environment, 'testing'>, string>> = Object.freeze({
    production: 'https://api.liguelead.com.br/v1',
    staging: 'https://homolog-api.liguelead.com.br/v1',
    development: 'http://localhost:3008/v1',
  });

  /**
   * Default per-attempt timeout. Above the API Gateway's own 29 s limit on purpose: the gateway then
   * answers 504 first, which is a definite answer, instead of the client giving up in the dark.
   */
  static readonly DEFAULT_TIMEOUT_MS = 30_000;

  /** Default number of retries of a GET. Other methods are never retried. */
  static readonly DEFAULT_MAX_RETRIES = 2;

  readonly baseUrl: string;

  readonly timeoutMs: number;

  readonly maxRetries: number;

  readonly httpAgent: HttpAgent | undefined;

  readonly httpsAgent: HttpsAgent | undefined;

  readonly #given: LigueLeadClientOptions;

  readonly #apiToken: string;

  readonly #appId: string | undefined;

  readonly #source: string | undefined;

  /**
   * @param {LigueLeadClientOptions} options - Options given to the client.
   *
   * @throws {LigueLeadConfigurationError} When a value is missing or out of range.
   */
  constructor(options: LigueLeadClientOptions) {
    this.#given = { ...options };

    this.#apiToken = ClientOptions.#nonEmpty(
      options.apiToken,
      'apiToken',
    );

    this.#appId = options.appId === undefined
      ? undefined
      : ClientOptions.#nonEmpty(
          options.appId,
          'appId',
        );

    this.#source = options.source === undefined
      ? undefined
      : ClientOptions.#nonEmpty(
          options.source,
          'source',
        );

    this.baseUrl = ClientOptions.#baseUrl(options);

    this.timeoutMs = ClientOptions.#positiveInteger(
      options.timeoutMs ?? ClientOptions.DEFAULT_TIMEOUT_MS,
      'timeoutMs',
    );

    this.maxRetries = ClientOptions.#nonNegativeInteger(
      options.maxRetries ?? ClientOptions.DEFAULT_MAX_RETRIES,
      'maxRetries',
    );

    this.httpAgent = options.httpAgent;
    this.httpsAgent = options.httpsAgent;
  }

  /**
   * The API token, sent as `api-token`.
   *
   * @returns {string} The value.
   */
  get apiToken(): string {
    return this.#apiToken;
  }

  /**
   * The app id, sent as `app-id`, when there is one.
   *
   * @returns {string | undefined} The value.
   */
  get appId(): string | undefined {
    return this.#appId;
  }

  /**
   * The `source` header, when there is one.
   *
   * @returns {string | undefined} The value.
   */
  get source(): string | undefined {
    return this.#source;
  }

  /**
   * The same options with some replaced.
   *
   * @param {Partial<LigueLeadClientOptions>} overrides - Options to replace.
   *
   * @throws {LigueLeadConfigurationError} When the resulting options are invalid.
   *
   * @returns {ClientOptions} New options; these are left unchanged.
   */
  withOverrides(overrides: Partial<LigueLeadClientOptions>): ClientOptions {
    return new ClientOptions({
      ...this.#given,
      ...overrides,
    });
  }

  /**
   * The timeout of one call: its own override, or the client's.
   *
   * @param {RequestOptions} [request] - The call's options.
   *
   * @throws {LigueLeadConfigurationError} When the override is not a positive integer.
   *
   * @returns {number} Milliseconds.
   */
  timeoutFor(request?: RequestOptions): number {
    return request?.timeoutMs === undefined
      ? this.timeoutMs
      : ClientOptions.#positiveInteger(
          request.timeoutMs,
          'timeoutMs',
        );
  }

  /**
   * The retries of one call: its own override, or the client's.
   *
   * @param {RequestOptions} [request] - The call's options.
   *
   * @throws {LigueLeadConfigurationError} When the override is not a non-negative integer.
   *
   * @returns {number} How many times a GET may be repeated.
   */
  maxRetriesFor(request?: RequestOptions): number {
    return request?.maxRetries === undefined
      ? this.maxRetries
      : ClientOptions.#nonNegativeInteger(
          request.maxRetries,
          'maxRetries',
        );
  }

  static #baseUrl(options: LigueLeadClientOptions): string {
    if (options.baseUrl === undefined) {
      const environment = options.environment ?? 'production';

      if (environment === 'testing') {
        throw new LigueLeadConfigurationError(
          'environment "testing" has no URL of its own: pass baseUrl (a mock server, or the API running locally)',
        );
      }

      const baseUrl = (ClientOptions.ENVIRONMENT_BASE_URLS as Partial<Record<string, string>>)[environment];

      if (baseUrl === undefined) {
        throw new LigueLeadConfigurationError(
          `environment must be one of ${ClientOptions.ENVIRONMENTS.join(', ')}; got "${environment}"`,
        );
      }

      return baseUrl;
    }

    let url: URL;

    try {
      url = new URL(options.baseUrl);
    } catch {
      throw new LigueLeadConfigurationError(`baseUrl must be an absolute URL; got "${options.baseUrl}"`);
    }

    if (
      url.protocol !== 'https:'
      && url.protocol !== 'http:'
    ) {
      throw new LigueLeadConfigurationError(`baseUrl must use http or https; got "${url.protocol}"`);
    }

    // Paths are appended after the base URL, so a query string or a fragment would end up in front of
    // every path and no call would reach its route.
    if (
      url.search !== ''
      || url.hash !== ''
    ) {
      throw new LigueLeadConfigurationError(`baseUrl must not carry a query string or a fragment; got "${options.baseUrl}"`);
    }

    // Without the version prefix every call would reach a route that does not exist, and fail one by
    // one with an HTML 404 instead of here.
    if (!ClientOptions.#withoutTrailingSlashes(url.pathname).endsWith('/v1')) {
      throw new LigueLeadConfigurationError(`baseUrl must end with /v1, like ${ClientOptions.ENVIRONMENT_BASE_URLS.production}; got "${options.baseUrl}"`);
    }

    // Paths are appended to the base URL, so a trailing slash would produce `//sms`.
    return ClientOptions.#withoutTrailingSlashes(options.baseUrl);
  }

  static #withoutTrailingSlashes(text: string): string {
    let end = text.length;

    while (
      end > 0
      && text[end - 1] === '/'
    ) {
      end--;
    }

    return text.slice(
      0,
      end,
    );
  }

  static #nonEmpty(
    value: unknown,
    name: string,
  ): string {
    if (
      typeof value !== 'string'
      || value.trim() === ''
    ) {
      throw new LigueLeadConfigurationError(`${name} must be a non-empty string`);
    }

    return value;
  }

  static #positiveInteger(
    value: number,
    name: string,
  ): number {
    if (
      !Number.isInteger(value)
      || value <= 0
    ) {
      throw new LigueLeadConfigurationError(`${name} must be a positive integer; got ${String(value)}`);
    }

    return value;
  }

  static #nonNegativeInteger(
    value: number,
    name: string,
  ): number {
    if (
      !Number.isInteger(value)
      || value < 0
    ) {
      throw new LigueLeadConfigurationError(`${name} must be a non-negative integer; got ${String(value)}`);
    }

    return value;
  }
}
