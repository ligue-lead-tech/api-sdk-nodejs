import {
  LigueLeadAbortError,
  LigueLeadApiError,
  LigueLeadConfigurationError,
  LigueLeadConnectionError,
  LigueLeadError,
  LigueLeadNotFoundError,
  LigueLeadRateLimitError,
  LigueLeadTimeoutError,
  LigueLeadUnexpectedResponseError,
  LigueLeadValidationError,
} from '../../../src/Errors';

const details = {
  status: 422,
  method: 'POST' as const,
  path: '/sms',
  body: { error: [{ field: 'phones', message: 'Required' }] },
  fieldErrors: [{ field: 'phones', message: 'Required' }],
  outcomeUnknown: false,
};

describe('errors', () => {
  it('names each error after its class and keeps the hierarchy', () => {
    const error = new LigueLeadValidationError('phones: Required', details);

    expect(error.name).toBe('LigueLeadValidationError');
    expect(error).toBeInstanceOf(LigueLeadApiError);
    expect(error).toBeInstanceOf(LigueLeadError);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('phones: Required');
    expect(error).toMatchObject({ status: 422, method: 'POST', path: '/sms', outcomeUnknown: false });
  });

  it('serializes name, message and fields for structured logs', () => {
    const json = JSON.parse(JSON.stringify(new LigueLeadValidationError('phones: Required', details)));

    expect(json).toEqual({
      name: 'LigueLeadValidationError',
      message: 'phones: Required',
      status: 422,
      method: 'POST',
      path: '/sms',
      body: details.body,
      fieldErrors: details.fieldErrors,
      outcomeUnknown: false,
    });
  });

  it('bounds the logged form of a large error, keeping the object whole', () => {
    const fieldErrors = Array.from({ length: 100 }, (_, index) => ({ field: `phones.${String(index)}`, message: 'Invalid' }));
    const error = new LigueLeadValidationError('many', { ...details, body: { error: fieldErrors }, fieldErrors });
    const json = error.toJSON();

    expect(error.fieldErrors).toHaveLength(100);
    expect(json.fieldErrors).toHaveLength(20);
    expect(json.fieldErrorCount).toBe(100);
    expect(typeof json.body).toBe('string');
    expect((json.body as string).length).toBe(2049);
    expect((json.body as string).endsWith('…')).toBe(true);
  });

  it('leaves a small or absent body as it is', () => {
    expect(new LigueLeadValidationError('x', { ...details, body: undefined }).toJSON()).not.toHaveProperty('fieldErrorCount');
    expect(new LigueLeadValidationError('x', { ...details, body: undefined }).toJSON().body).toBeUndefined();
  });

  it('carries the subclass-specific fields', () => {
    const notFound = new LigueLeadNotFoundError('Cannot GET /v1/x', { ...details, status: 404, routeNotFound: true });
    const rateLimited = new LigueLeadRateLimitError('Too Many Requests', { ...details, status: 429, retryAfterMs: 2000 });

    expect(notFound.routeNotFound).toBe(true);
    expect(rateLimited.retryAfterMs).toBe(2000);
  });

  it('keeps transport details and the cause', () => {
    const cause = new Error('socket hang up');
    const error = new LigueLeadTimeoutError(
      'POST /sms timed out',
      { method: 'POST', path: '/sms', code: 'ETIMEDOUT', outcomeUnknown: true },
      { cause },
    );

    expect(error).toBeInstanceOf(LigueLeadConnectionError);
    expect(error.name).toBe('LigueLeadTimeoutError');
    expect(error.cause).toBe(cause);
    expect(error).toMatchObject({ code: 'ETIMEDOUT', outcomeUnknown: true });
  });

  it('builds the errors that carry no request details', () => {
    expect(new LigueLeadAbortError('aborted').name).toBe('LigueLeadAbortError');
    expect(new LigueLeadConfigurationError('missing appId')).toBeInstanceOf(LigueLeadError);

    const unexpected = new LigueLeadUnexpectedResponseError('no data', {
      status: 200,
      method: 'GET',
      path: '/apps',
      body: { message: 'ok' },
    });

    expect(unexpected).toMatchObject({ status: 200, method: 'GET', path: '/apps', body: { message: 'ok' } });
  });
});
