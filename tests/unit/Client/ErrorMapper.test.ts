import { AxiosError } from 'axios';
import { ErrorMapper } from '../../../src/Client/ErrorMapper';
import { Json } from '../../../src/Support/Json';
import {
  LigueLeadAbortError,
  LigueLeadApiError,
  LigueLeadAuthenticationError,
  LigueLeadBadRequestError,
  LigueLeadConflictError,
  LigueLeadConnectionError,
  LigueLeadNotFoundError,
  LigueLeadPayloadTooLargeError,
  LigueLeadRateLimitError,
  LigueLeadServerError,
  LigueLeadTimeoutError,
  LigueLeadUnsupportedMediaTypeError,
  LigueLeadValidationError,
} from '../../../src/Errors';

const EXPRESS_404 = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Error</title>
</head>
<body>
<pre>Cannot POST /v1/nope</pre>
</body>
</html>
`;

const mapper = new ErrorMapper({ now: () => 0 });

describe('ErrorMapper.parseBody', () => {
  it('reads a Zod validation answer', () => {
    const parsed = mapper.parseBody({
      error: [
        { field: 'phones.3', message: 'Invalid phone number' },
        { field: '', message: 'Unrecognized key: "sms_fallback_message"' },
        { message: 'not a field error' },
      ],
    });

    expect(parsed).toEqual({
      message: 'phones.3: Invalid phone number; Unrecognized key: "sms_fallback_message"',
      fieldErrors: [
        { field: 'phones.3', message: 'Invalid phone number' },
        { field: '', message: 'Unrecognized key: "sms_fallback_message"' },
      ],
      routeNotFound: false,
    });
  });

  it('names the first five field errors in the message, and counts the rest', () => {
    const error = Array.from({ length: 8 }, (_, index) => ({ field: `phones.${String(index)}`, message: 'Invalid' }));
    const parsed = mapper.parseBody({ error });

    expect(parsed.fieldErrors).toHaveLength(8);
    expect(parsed.message).toBe(
      'phones.0: Invalid; phones.1: Invalid; phones.2: Invalid; phones.3: Invalid; phones.4: Invalid; and 3 more',
    );
  });

  it('reads a business error, passing Portuguese through unchanged', () => {
    expect(mapper.parseBody({ error: 'Mensagem contém palavras proibidas: x' })).toEqual({
      message: 'Mensagem contém palavras proibidas: x',
      fieldErrors: [],
      routeNotFound: false,
    });
  });

  it('reads the 413 shape, which also carries a status', () => {
    expect(mapper.parseBody({ status: 413, error: 'Payload too large. Maximum allowed size is 250 KB.' }).message)
      .toBe('Payload too large. Maximum allowed size is 250 KB.');
  });

  it('reads an API Gateway answer', () => {
    expect(mapper.parseBody({ message: 'Too Many Requests' }).message).toBe('Too Many Requests');
  });

  it("reads Express's HTML 404 and flags the missing route", () => {
    expect(mapper.parseBody(EXPRESS_404)).toEqual({
      message: 'Cannot POST /v1/nope',
      fieldErrors: [],
      routeNotFound: true,
    });
  });

  it('strips tags from other HTML pages', () => {
    expect(mapper.parseBody('<html><body><h1>Bad   Gateway</h1></body></html>')).toEqual({
      message: 'Bad Gateway',
      fieldErrors: [],
      routeNotFound: false,
    });
  });

  it('keeps the text after a < that never closes, as the tag regex did', () => {
    expect(mapper.parseBody('<html><body><h1>Bad Gateway</h1> upstream failed: a < b').message)
      .toBe('Bad Gateway upstream failed: a < b');
  });

  it('truncates plain text', () => {
    const parsed = mapper.parseBody('x'.repeat(500));

    expect(parsed.message).toBe(`${'x'.repeat(300)}…`);
  });

  it.each([undefined, null, '', '   ', {}, { error: '' }, { error: [] }, { error: 42 }, [1, 2], 42])(
    'finds no message in %p',
    (body) => {
      expect(mapper.parseBody(body)).toEqual({ message: undefined, fieldErrors: [], routeNotFound: false });
    },
  );
});

describe('ErrorMapper.fromResponse', () => {
  const context = { method: 'GET' as const, path: '/apps' };

  it.each([
    [400, LigueLeadBadRequestError],
    [401, LigueLeadAuthenticationError],
    [404, LigueLeadNotFoundError],
    [409, LigueLeadConflictError],
    [413, LigueLeadPayloadTooLargeError],
    [415, LigueLeadUnsupportedMediaTypeError],
    [422, LigueLeadValidationError],
    [429, LigueLeadRateLimitError],
    [500, LigueLeadServerError],
    [502, LigueLeadServerError],
    [504, LigueLeadServerError],
    [302, LigueLeadApiError],
    [403, LigueLeadApiError],
  ])('maps %i to %p', (status, errorClass) => {
    const error = mapper.fromResponse(status, { error: 'reason' }, {}, context);

    expect(error).toBeInstanceOf(errorClass);
    expect(error.constructor).toBe(errorClass);
    expect(error).toMatchObject({ status, method: 'GET', path: '/apps', message: 'reason' });
  });

  it('falls back to a generic message', () => {
    expect(mapper.fromResponse(503, undefined, {}, context).message).toBe('Request failed with status 503');
  });

  it('keeps field errors on a 422', () => {
    const error = mapper.fromResponse(422, { error: [{ field: 'name', message: 'Name is required' }] }, {}, context);

    expect(error.fieldErrors).toEqual([{ field: 'name', message: 'Name is required' }]);
  });

  it('flags a missing route on the HTML 404 only', () => {
    expect(mapper.fromResponse(404, EXPRESS_404, {}, context)).toMatchObject({ routeNotFound: true });
    expect(mapper.fromResponse(404, { error: 'App not found' }, {}, context)).toMatchObject({ routeNotFound: false });
  });

  it('reads Retry-After on a 429', () => {
    const error = mapper.fromResponse(429, { message: 'Too Many Requests' }, { 'retry-after': '2' }, context);

    expect(error).toMatchObject({ retryAfterMs: 2000 });
  });

  it('marks a 5xx outcome unknown for a non-GET only', () => {
    expect(mapper.fromResponse(502, undefined, {}, { method: 'POST', path: '/sms' }).outcomeUnknown).toBe(true);
    expect(mapper.fromResponse(502, undefined, {}, context).outcomeUnknown).toBe(false);
    expect(mapper.fromResponse(422, undefined, {}, { method: 'POST', path: '/sms' }).outcomeUnknown).toBe(false);
  });

  it('truncates a long text body', () => {
    const error = mapper.fromResponse(500, 'y'.repeat(3000), {}, context);

    expect(error.body).toBe(`${'y'.repeat(2048)}…`);
  });
});

describe('ErrorMapper.fromTransport', () => {
  const context = { method: 'POST' as const, path: '/sms' };

  it('maps a timeout, keeping only code and message as the cause', () => {
    const axiosError = new AxiosError('timeout of 30000ms exceeded', 'ETIMEDOUT');

    axiosError.config = { headers: { 'api-token': 'secret' } } as never;

    const error = mapper.fromTransport(axiosError, context);

    expect(error).toBeInstanceOf(LigueLeadTimeoutError);
    expect(error).toMatchObject({ method: 'POST', path: '/sms', code: 'ETIMEDOUT', outcomeUnknown: true });
    expect((error as Error).cause).not.toBe(axiosError);
    expect(JSON.stringify((error as Error).cause)).not.toContain('secret');
    expect((error as Error).cause).toMatchObject({ message: 'timeout of 30000ms exceeded', code: 'ETIMEDOUT' });
  });

  it('maps a connection failure', () => {
    const error = mapper.fromTransport(new AxiosError('socket hang up', 'ECONNRESET'), { method: 'GET', path: '/apps' });

    expect(error).toBeInstanceOf(LigueLeadConnectionError);
    expect(error).not.toBeInstanceOf(LigueLeadTimeoutError);
    expect(error).toMatchObject({ code: 'ECONNRESET', outcomeUnknown: false, message: 'GET /apps failed: socket hang up' });
  });

  it('maps a cancellation', () => {
    expect(mapper.fromTransport(new AxiosError('canceled', 'ERR_CANCELED'), context)).toBeInstanceOf(LigueLeadAbortError);
  });

  it('returns anything else unchanged', () => {
    const bug = new TypeError('bug');

    expect(mapper.fromTransport(bug, context)).toBe(bug);
  });
});

describe('Json.isObject', () => {
  it('accepts plain objects only', () => {
    expect(Json.isObject({})).toBe(true);
    expect(Json.isObject([])).toBe(false);
    expect(Json.isObject(null)).toBe(false);
    expect(Json.isObject('x')).toBe(false);
  });
});
