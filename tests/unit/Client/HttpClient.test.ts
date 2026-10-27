import nock from 'nock';
import { inspect } from 'node:util';
import {
  LigueLeadAbortError,
  LigueLeadApiError,
  LigueLeadAuthenticationError,
  LigueLeadConfigurationError,
  LigueLeadConnectionError,
  LigueLeadRateLimitError,
  LigueLeadServerError,
  LigueLeadTimeoutError,
  LigueLeadUnexpectedResponseError,
} from '../../../src/Errors';
import { HttpClient } from '../../../src/Client/HttpClient';
import { API_TOKEN, APP_ID, ORIGIN, appApi, createHttp, tokenApi } from '../Helpers/ApiMocks';

/**
 * A reset connection. nock 14 needs an `Error` instance here: a plain object makes the request hang
 * until it times out.
 *
 * @returns {Error} The error nock raises on the request.
 */
function connectionReset(): Error {
  return Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' });
}

describe('HttpClient', () => {
  describe('headers', () => {
    it('sends both credentials, Accept and the SDK user agent on an app-scoped route', async () => {
      appApi()
        .matchHeader('accept', 'application/json')
        .matchHeader('user-agent', HttpClient.USER_AGENT)
        .get('/v1/x')
        .reply(200, { ok: true });

      await expect(createHttp().request({ method: 'GET', path: '/x', auth: 'app', envelope: false }))
        .resolves.toEqual({ ok: true });
    });

    it('sends only the token on a token-scoped route', async () => {
      tokenApi().get('/v1/apps').reply(200, { data: [] });

      await createHttp().request({ method: 'GET', path: '/apps', auth: 'token', envelope: true });
    });

    it('works without appId on a token-scoped route', async () => {
      tokenApi().get('/v1/apps').reply(200, { data: [] });

      await createHttp({ appId: undefined }).request({ method: 'GET', path: '/apps', auth: 'token', envelope: true });
    });

    it('refuses an app-scoped route without appId, before any request', async () => {
      const request = createHttp({ appId: undefined }).request({ method: 'POST', path: '/sms', auth: 'app', envelope: true });

      await expect(request).rejects.toBeInstanceOf(LigueLeadConfigurationError);
      await expect(request).rejects.toThrow('POST /sms needs an appId');
    });

    it('sends source only when it is set', async () => {
      appApi().matchHeader('source', 'erp').get('/v1/x').reply(200, {});
      nock(ORIGIN, { badheaders: ['source'] }).get('/v1/y').reply(200, {});

      await createHttp({ source: 'erp' }).request({ method: 'GET', path: '/x', auth: 'app', envelope: false });
      await createHttp().request({ method: 'GET', path: '/y', auth: 'app', envelope: false });
    });
  });

  describe('bodies', () => {
    it('sends a JSON body and drops undefined query values', async () => {
      appApi()
        .matchHeader('content-type', /^application\/json/)
        .post('/v1/x', { a: 1 })
        .query({ limit: '10', flag: 'true' })
        .reply(201, { data: { id: 1 } });

      const result = await createHttp().request({
        method: 'POST',
        path: '/x',
        query: { limit: 10, flag: true, cursor: undefined },
        body: { a: 1 },
        auth: 'app',
        envelope: true,
      });

      expect(result).toEqual({ id: 1 });
    });

    it('sends no query string when every value is undefined', async () => {
      appApi().get('/v1/x').reply(200, {});

      await createHttp().request({ method: 'GET', path: '/x', query: { cursor: undefined }, auth: 'app', envelope: false });
    });

    it('returns the bare body when the route has no envelope', async () => {
      appApi().get('/v1/x').reply(200, [{ id: 'a' }]);

      await expect(createHttp().request({ method: 'GET', path: '/x', auth: 'app', envelope: false }))
        .resolves.toEqual([{ id: 'a' }]);
    });

    it('returns undefined for a 204', async () => {
      appApi().delete('/v1/x').reply(204);

      await expect(createHttp().request({ method: 'DELETE', path: '/x', auth: 'app', envelope: false }))
        .resolves.toBeUndefined();
    });

    it('returns undefined for a 204 on a route that usually answers an envelope', async () => {
      appApi().delete('/v1/x').reply(204);

      await expect(createHttp().request({ method: 'DELETE', path: '/x', auth: 'app', envelope: true }))
        .resolves.toBeUndefined();
    });

    it('accepts any 2xx', async () => {
      appApi().post('/v1/x').reply(202, { data: { campaign_id: 'c' } });

      await expect(createHttp().request({ method: 'POST', path: '/x', body: {}, auth: 'app', envelope: true }))
        .resolves.toEqual({ campaign_id: 'c' });
    });

    it('refuses an envelope without data', async () => {
      appApi().get('/v1/x').reply(200, { message: 'ok' });

      const request = createHttp().request({ method: 'GET', path: '/x', auth: 'app', envelope: true });

      await expect(request).rejects.toBeInstanceOf(LigueLeadUnexpectedResponseError);
      await expect(request).rejects.toMatchObject({ status: 200, body: { message: 'ok' } });
    });

    it('refuses an empty body where an envelope is expected', async () => {
      appApi().get('/v1/x').reply(200, '');

      await expect(createHttp().request({ method: 'GET', path: '/x', auth: 'app', envelope: true }))
        .rejects.toBeInstanceOf(LigueLeadUnexpectedResponseError);
    });
  });

  describe('errors', () => {
    it('maps an error answer to the subclass of its status', async () => {
      appApi().post('/v1/x').reply(422, { error: [{ field: 'phones', message: 'Required' }] });

      await expect(createHttp().request({ method: 'POST', path: '/x', body: {}, auth: 'app', envelope: true }))
        .rejects.toMatchObject({ status: 422, message: 'phones: Required', fieldErrors: [{ field: 'phones', message: 'Required' }] });
    });

    it('does not follow a redirect, which would forward the token', async () => {
      appApi().get('/v1/x').reply(302, '', { location: 'https://elsewhere.test/steal' });

      const request = createHttp().request({ method: 'GET', path: '/x', auth: 'app', envelope: false });

      await expect(request).rejects.toBeInstanceOf(LigueLeadApiError);
      await expect(request).rejects.toMatchObject({ status: 302 });
    });

    it('refuses an absolute URL as a path', async () => {
      const request = createHttp({ maxRetries: 0 }).request({
        method: 'GET',
        path: 'https://elsewhere.test/steal',
        auth: 'app',
        envelope: false,
      });

      await expect(request).rejects.toBeInstanceOf(LigueLeadConnectionError);
    });

    it('maps a reset connection, without the token anywhere in the error', async () => {
      appApi().post('/v1/x').replyWithError(connectionReset());

      const error: unknown = await createHttp()
        .request({ method: 'POST', path: '/x', body: {}, auth: 'app', envelope: true })
        .catch((thrown: unknown) => thrown);

      expect(error).toBeInstanceOf(LigueLeadConnectionError);
      expect(error).toMatchObject({ code: 'ECONNRESET', outcomeUnknown: true });
      expect(inspect(error, { depth: 10 })).not.toContain(API_TOKEN);
      expect(JSON.stringify(error)).not.toContain(API_TOKEN);
    });

    it('times out after timeoutMs', async () => {
      appApi().post('/v1/x').delay(500).reply(200, { data: {} });

      await expect(
        createHttp({ timeoutMs: 50 }).request({ method: 'POST', path: '/x', body: {}, auth: 'app', envelope: true }),
      ).rejects.toBeInstanceOf(LigueLeadTimeoutError);
    });

    it('lets a call override the timeout', async () => {
      appApi().get('/v1/x').delay(500).reply(200, {});

      await expect(
        createHttp({ maxRetries: 0 }).request({
          method: 'GET',
          path: '/x',
          auth: 'app',
          envelope: false,
          options: { timeoutMs: 50 },
        }),
      ).rejects.toBeInstanceOf(LigueLeadTimeoutError);
    });

    it('stops when the caller aborts', async () => {
      appApi().get('/v1/x').delay(500).reply(200, {});

      const controller = new AbortController();
      const request = createHttp().request({
        method: 'GET',
        path: '/x',
        auth: 'app',
        envelope: false,
        options: { signal: controller.signal },
      });

      setTimeout(() => {
        controller.abort();
      }, 20);

      await expect(request).rejects.toBeInstanceOf(LigueLeadAbortError);
    });
  });

  describe('retries', () => {
    it('repeats a GET after a 503, waiting the backoff', async () => {
      const waits: number[] = [];

      appApi().get('/v1/x').reply(503, { error: 'Internal server error' });
      appApi().get('/v1/x').replyWithError(connectionReset());
      appApi().get('/v1/x').reply(200, { ok: true });

      const http = createHttp({ maxRetries: 2 }, {
        sleep: (ms) => {
          waits.push(ms);
          return Promise.resolve();
        },
        random: () => 0.5,
      });

      await expect(http.request({ method: 'GET', path: '/x', auth: 'app', envelope: false })).resolves.toEqual({ ok: true });
      expect(waits).toEqual([250, 500]);
    });

    it('gives up after maxRetries', async () => {
      appApi().get('/v1/x').times(3).reply(502, { error: 'Internal server error' });

      await expect(createHttp({ maxRetries: 2 }).request({ method: 'GET', path: '/x', auth: 'app', envelope: false }))
        .rejects.toBeInstanceOf(LigueLeadServerError);
    });

    it('lets a call turn retries off', async () => {
      appApi().get('/v1/x').once().reply(503, {});

      await expect(
        createHttp({ maxRetries: 2 }).request({
          method: 'GET',
          path: '/x',
          auth: 'app',
          envelope: false,
          options: { maxRetries: 0 },
        }),
      ).rejects.toBeInstanceOf(LigueLeadServerError);
    });

    it.each([
      ['a 503', (scope: nock.Interceptor) => scope.reply(503, {})],
      ['a reset connection', (scope: nock.Interceptor) => scope.replyWithError(connectionReset())],
    ])('sends a POST exactly once after %s', async (_label, reply) => {
      reply(appApi().post('/v1/sms'));

      const error: unknown = await createHttp({ maxRetries: 5 })
        .request({ method: 'POST', path: '/sms', body: {}, auth: 'app', envelope: true })
        .catch((thrown: unknown) => thrown);

      expect(error).toMatchObject({ outcomeUnknown: true });
    });

    it('never repeats a 401', async () => {
      appApi().get('/v1/x').once().reply(401, { error: 'Authorization token is blocked' });

      await expect(createHttp({ maxRetries: 5 }).request({ method: 'GET', path: '/x', auth: 'app', envelope: false }))
        .rejects.toBeInstanceOf(LigueLeadAuthenticationError);
    });

    it('waits the Retry-After of a 429', async () => {
      const waits: number[] = [];

      appApi().get('/v1/x').reply(429, { message: 'Too Many Requests' }, { 'Retry-After': '2' });
      appApi().get('/v1/x').reply(200, {});

      await createHttp({ maxRetries: 1 }, {
        sleep: (ms) => {
          waits.push(ms);
          return Promise.resolve();
        },
      }).request({ method: 'GET', path: '/x', auth: 'app', envelope: false });

      expect(waits).toEqual([2000]);
    });

    it('hands a long Retry-After to the caller', async () => {
      appApi().get('/v1/x').once().reply(429, { message: 'Too Many Requests' }, { 'Retry-After': '120' });

      await expect(createHttp({ maxRetries: 3 }).request({ method: 'GET', path: '/x', auth: 'app', envelope: false }))
        .rejects.toMatchObject({ constructor: LigueLeadRateLimitError, retryAfterMs: 120_000 });
    });

    it('stops waiting between retries when the caller aborts', async () => {
      appApi().get('/v1/x').once().reply(503, {});

      const controller = new AbortController();
      const http = createHttp({ maxRetries: 2 }, {
        sleep: () => {
          controller.abort();
          return Promise.reject(new LigueLeadAbortError('The request was aborted'));
        },
      });

      await expect(
        http.request({ method: 'GET', path: '/x', auth: 'app', envelope: false, options: { signal: controller.signal } }),
      ).rejects.toBeInstanceOf(LigueLeadAbortError);
    });
  });

  it('keeps the credentials out of inspect and JSON', () => {
    const http = createHttp({ source: 'erp' });

    expect(inspect(http, { depth: 10, showHidden: true })).not.toContain(API_TOKEN);
    expect(inspect(http, { depth: 10, showHidden: true })).not.toContain(APP_ID);
    expect(JSON.stringify(http)).not.toContain(API_TOKEN);
  });
});
