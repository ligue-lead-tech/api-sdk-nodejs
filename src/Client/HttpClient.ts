import axios, { type AxiosInstance, type AxiosResponse, type RawAxiosRequestHeaders } from 'axios';
import type { ClientOptions } from '../Config/ClientOptions';
import { SdkVersion } from '../Config/SdkVersion';
import { LigueLeadConfigurationError } from '../Errors/LigueLeadConfigurationError';
import { LigueLeadUnexpectedResponseError } from '../Errors/LigueLeadUnexpectedResponseError';
import { Json } from '../Support/Json';
import type { ApiRequest, QueryValue, RequestContext } from '../Types/Http';
import { ErrorMapper } from './ErrorMapper';
import { RetryPolicy } from './RetryPolicy';

/** What `HttpClient` delegates to; tests replace them. */
export interface HttpClientCollaborators {
  retryPolicy?: RetryPolicy;
  errorMapper?: ErrorMapper;
}

/**
 * The transport every resource goes through.
 *
 * Credentials are added per request and come from `ClientOptions`, which keeps them in private
 * fields — so they never appear in the axios instance defaults, in `util.inspect` or in
 * `JSON.stringify` of the client. Statuses are read here rather than by axios (`validateStatus`
 * accepts everything), so only a missing answer throws from axios itself.
 */
export class HttpClient {
  static readonly USER_AGENT = `ligue-lead-api-sdk-node/${SdkVersion.current} node/${process.version}`;

  readonly #axios: AxiosInstance;

  readonly #options: ClientOptions;

  readonly #retryPolicy: RetryPolicy;

  readonly #errorMapper: ErrorMapper;

  /**
   * @param {ClientOptions} options - The client's options.
   * @param {HttpClientCollaborators} [collaborators] - Replacements for the retry policy and the error mapper.
   */
  constructor(
    options: ClientOptions,
    collaborators: HttpClientCollaborators = {},
  ) {
    this.#options = options;
    this.#retryPolicy = collaborators.retryPolicy ?? new RetryPolicy();
    this.#errorMapper = collaborators.errorMapper ?? new ErrorMapper();

    this.#axios = axios.create({
      baseURL: options.baseUrl,
      adapter: 'http',
      // follow-redirects forwards custom headers to the new location, `api-token` included.
      maxRedirects: 0,
      // A path can never point the credentials at another host.
      allowAbsoluteUrls: false,
      validateStatus: () => true,
      transitional: { clarifyTimeoutError: true },
      httpAgent: options.httpAgent,
      httpsAgent: options.httpsAgent,
      // No default Content-Type: with `application/json` set, axios serializes a FormData as JSON.
      headers: {
        Accept: 'application/json',
        'User-Agent': HttpClient.USER_AGENT,
      },
    });
  }

  /**
   * Sends a request, repeating a GET on transient failures.
   *
   * @param {ApiRequest} request - The call to make.
   *
   * @throws {LigueLeadConfigurationError} When the route needs an `appId` the client does not have.
   * @throws {LigueLeadApiError} When the API answers outside 2xx (a subclass per status).
   * @throws {LigueLeadConnectionError} When no answer is received.
   * @throws {LigueLeadAbortError} When the caller's signal aborts.
   * @throws {LigueLeadUnexpectedResponseError} When a 2xx body is not in the expected shape.
   *
   * @returns {Promise<T>} The `data` of an envelope, the body itself, or `undefined` for a 204.
   */
  async request<T>(request: ApiRequest): Promise<T> {
    const headers = this.#headers(request);
    const timeout = this.#options.timeoutFor(request.options);
    const maxRetries = this.#options.maxRetriesFor(request.options);

    for (let attempt = 0; ; attempt++) {
      try {
        return await this.#attempt<T>(
          request,
          headers,
          timeout,
        );
      } catch (error) {
        const delay = attempt < maxRetries && this.#retryPolicy.shouldRetry(
          request.method,
          error,
        )
          ? this.#retryPolicy.delayFor(
              error,
              attempt,
            )
          : undefined;

        if (delay === undefined) {
          throw error;
        }

        await this.#retryPolicy.pause(
          delay,
          request.options?.signal,
        );
      }
    }
  }

  async #attempt<T>(
    request: ApiRequest,
    headers: RawAxiosRequestHeaders,
    timeout: number,
  ): Promise<T> {
    const context: RequestContext = {
      method: request.method,
      path: request.path,
    };

    let response: AxiosResponse<unknown>;

    try {
      response = await this.#axios.request<unknown>({
        method: request.method,
        url: request.path,
        params: HttpClient.#definedOnly(request.query),
        data: request.body,
        headers,
        timeout,
        signal: request.options?.signal,
      });
    } catch (error) {
      throw this.#errorMapper.fromTransport(
        error,
        context,
      );
    }

    const body = response.data === ''
      ? undefined
      : response.data;

    if (
      response.status < 200
      || response.status >= 300
    ) {
      throw this.#errorMapper.fromResponse(
        response.status,
        body,
        response.headers,
        context,
      );
    }

    // 204 is success with nothing to read, whatever shape the route usually answers in.
    if (
      response.status === 204
      || !request.envelope
    ) {
      return body as T;
    }

    if (
      Json.isObject(body)
      && 'data' in body
    ) {
      return body.data as T;
    }

    throw new LigueLeadUnexpectedResponseError(
      `Expected a { data } envelope in the answer to ${request.method} ${request.path}`,
      {
        status: response.status,
        method: request.method,
        path: request.path,
        body,
      },
    );
  }

  #headers(request: ApiRequest): RawAxiosRequestHeaders {
    const {
      apiToken,
      appId,
      source,
    } = this.#options;

    const headers: RawAxiosRequestHeaders = { 'api-token': apiToken };

    if (request.auth === 'app') {
      if (appId === undefined) {
        throw new LigueLeadConfigurationError(
          `${request.method} ${request.path} needs an appId: pass it to the client, or derive one with client.withOptions({ appId })`,
        );
      }

      headers['app-id'] = appId;
    }

    if (source !== undefined) {
      headers.source = source;
    }

    return headers;
  }

  static #definedOnly(
    query: Readonly<Record<string, QueryValue>> | undefined,
  ): Record<string, string | number | boolean> | undefined {
    if (query === undefined) {
      return undefined;
    }

    const entries = Object.entries(query).filter(
      (entry): entry is [string, string | number | boolean] => entry[1] !== undefined,
    );

    return entries.length > 0
      ? Object.fromEntries(entries)
      : undefined;
  }
}
