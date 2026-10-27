import nock from 'nock';
import { ErrorMapper } from '../../../src/Client/ErrorMapper';
import { HttpClient } from '../../../src/Client/HttpClient';
import { RetryPolicy, type RetryPolicyCollaborators } from '../../../src/Client/RetryPolicy';
import { ClientOptions } from '../../../src/Config/ClientOptions';
import { LigueLeadClient } from '../../../src/LigueLeadClient';
import type { LigueLeadClientOptions } from '../../../src/Types/ClientOptions';

export const ORIGIN = 'https://api.test';
export const BASE_URL = `${ORIGIN}/v1`;
export const API_TOKEN = 'tok_test_1234567890';
export const APP_ID = 'app_test_42';

/**
 * A client pointed at the mocked host, with retries off unless a test turns them on.
 *
 * @param {Partial<LigueLeadClientOptions>} [overrides] - Options to replace.
 *
 * @returns {LigueLeadClient} The client.
 */
export function createClient(overrides: Partial<LigueLeadClientOptions> = {}): LigueLeadClient {
  return new LigueLeadClient({ apiToken: API_TOKEN, appId: APP_ID, baseUrl: BASE_URL, maxRetries: 0, ...overrides });
}

/**
 * A transport pointed at the mocked host, whose retry policy waits nothing and draws 0.5.
 *
 * @param {Partial<LigueLeadClientOptions>} [overrides] - Options to replace.
 * @param {RetryPolicyCollaborators} [retry] - Replacements for the retry policy's sleep and random.
 * @param {() => number} [now] - Clock of the error mapper.
 *
 * @returns {HttpClient} The transport.
 */
export function createHttp(
  overrides: Partial<LigueLeadClientOptions> = {},
  retry: RetryPolicyCollaborators = {},
  now: () => number = Date.now,
): HttpClient {
  return new HttpClient(
    new ClientOptions({ apiToken: API_TOKEN, appId: APP_ID, baseUrl: BASE_URL, ...overrides }),
    {
      retryPolicy: new RetryPolicy({ sleep: () => Promise.resolve(), random: () => 0.5, ...retry }),
      errorMapper: new ErrorMapper({ now }),
    },
  );
}

/**
 * A mock of the API host that only matches requests carrying both credentials.
 *
 * @returns {nock.Scope} The scope.
 */
export function appApi(): nock.Scope {
  return nock(ORIGIN, { reqheaders: { 'api-token': API_TOKEN, 'app-id': APP_ID } });
}

/**
 * A mock of the API host that only matches requests carrying the token and no app id.
 *
 * @returns {nock.Scope} The scope.
 */
export function tokenApi(): nock.Scope {
  return nock(ORIGIN, { reqheaders: { 'api-token': API_TOKEN }, badheaders: ['app-id'] });
}
