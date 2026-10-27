import { inspect } from 'node:util';
import { ClientOptions } from '../../../src/Config/ClientOptions';
import { LigueLeadConfigurationError } from '../../../src/Errors';
import type { Environment } from '../../../src/Types/ClientOptions';

describe('ClientOptions', () => {
  it('defaults to production, the default timeout and the default retries', () => {
    const options = new ClientOptions({ apiToken: 'tok' });

    expect(options).toMatchObject({
      apiToken: 'tok',
      appId: undefined,
      source: undefined,
      baseUrl: 'https://api.liguelead.com.br/v1',
      timeoutMs: ClientOptions.DEFAULT_TIMEOUT_MS,
      maxRetries: ClientOptions.DEFAULT_MAX_RETRIES,
      httpAgent: undefined,
      httpsAgent: undefined,
    });
  });

  it.each([
    ['production', 'https://api.liguelead.com.br/v1'],
    ['staging', 'https://homolog-api.liguelead.com.br/v1'],
    ['development', 'http://localhost:3008/v1'],
  ] as const)('resolves the %s environment', (environment, url) => {
    expect(new ClientOptions({ apiToken: 'tok', environment }).baseUrl).toBe(url);
    expect(ClientOptions.ENVIRONMENT_BASE_URLS[environment]).toBe(url);
  });

  it('lists every environment', () => {
    expect(ClientOptions.ENVIRONMENTS).toEqual(['production', 'staging', 'development', 'testing']);
  });

  it('requires baseUrl for testing, and takes it', () => {
    expect(() => new ClientOptions({ apiToken: 'tok', environment: 'testing' })).toThrow(LigueLeadConfigurationError);
    expect(() => new ClientOptions({ apiToken: 'tok', environment: 'testing' })).toThrow('environment "testing" has no URL of its own');
    expect(new ClientOptions({ apiToken: 'tok', environment: 'testing', baseUrl: 'http://127.0.0.1:4010/v1' }).baseUrl)
      .toBe('http://127.0.0.1:4010/v1');
  });

  it('lets baseUrl override the environment and strips trailing slashes', () => {
    expect(new ClientOptions({ apiToken: 'tok', environment: 'staging', baseUrl: 'http://localhost:3008/v1//' }).baseUrl)
      .toBe('http://localhost:3008/v1');
    expect(new ClientOptions({ apiToken: 'tok', baseUrl: 'https://gateway.test/ligue-lead/v1' }).baseUrl)
      .toBe('https://gateway.test/ligue-lead/v1');
  });

  it('keeps appId, source, timeouts and retries as given', () => {
    const options = new ClientOptions({ apiToken: 'tok', appId: 'app', source: 'erp', timeoutMs: 5000, maxRetries: 0 });

    expect(options).toMatchObject({ appId: 'app', source: 'erp', timeoutMs: 5000, maxRetries: 0 });
  });

  it('keeps the credentials out of inspect and JSON', () => {
    const options = new ClientOptions({ apiToken: 'tok_secret', appId: 'app_secret', source: 'erp' });

    expect(inspect(options, { depth: 5, showHidden: true })).not.toMatch(/tok_secret|app_secret/);
    expect(JSON.stringify(options)).not.toMatch(/tok_secret|app_secret/);
  });

  it.each([
    [{ apiToken: '' }, /apiToken must be a non-empty string/],
    [{ apiToken: '   ' }, /apiToken must be a non-empty string/],
    [{ apiToken: undefined as unknown as string }, /apiToken must be a non-empty string/],
    [{ apiToken: 'tok', appId: '' }, /appId must be a non-empty string/],
    [{ apiToken: 'tok', source: ' ' }, /source must be a non-empty string/],
    [{ apiToken: 'tok', timeoutMs: 0 }, /timeoutMs must be a positive integer; got 0/],
    [{ apiToken: 'tok', timeoutMs: 1.5 }, /timeoutMs must be a positive integer/],
    [{ apiToken: 'tok', maxRetries: -1 }, /maxRetries must be a non-negative integer; got -1/],
    [{ apiToken: 'tok', baseUrl: 'not a url' }, /baseUrl must be an absolute URL/],
    [{ apiToken: 'tok', baseUrl: 'ftp://api.test/v1' }, /baseUrl must use http or https/],
    [{ apiToken: 'tok', baseUrl: 'https://api.liguelead.com.br' }, /baseUrl must end with \/v1/],
    [{ apiToken: 'tok', baseUrl: 'https://api.test/v2' }, /baseUrl must end with \/v1/],
    [{ apiToken: 'tok', baseUrl: 'https://gateway.test/v1?tenant=x' }, /must not carry a query string or a fragment/],
    [{ apiToken: 'tok', baseUrl: 'https://gateway.test/v1#x' }, /must not carry a query string or a fragment/],
    [{ apiToken: 'tok', environment: 'sandbox' as Environment }, /environment must be one of production, staging, development, testing; got "sandbox"/],
  ])('refuses %j', (given, message) => {
    expect(() => new ClientOptions(given)).toThrow(LigueLeadConfigurationError);
    expect(() => new ClientOptions(given)).toThrow(message);
  });

  it('derives new options, leaving these unchanged', () => {
    const options = new ClientOptions({ apiToken: 'tok', appId: 'a' });
    const derived = options.withOverrides({ appId: 'b', timeoutMs: 100 });

    expect(derived).toMatchObject({ apiToken: 'tok', appId: 'b', timeoutMs: 100 });
    expect(options.appId).toBe('a');
    expect(() => options.withOverrides({ maxRetries: -1 })).toThrow(LigueLeadConfigurationError);
  });

  it('resolves the timeout and the retries of one call', () => {
    const options = new ClientOptions({ apiToken: 'tok', timeoutMs: 1000, maxRetries: 2 });

    expect(options.timeoutFor()).toBe(1000);
    expect(options.timeoutFor({ timeoutMs: 10 })).toBe(10);
    expect(options.maxRetriesFor({})).toBe(2);
    expect(options.maxRetriesFor({ maxRetries: 0 })).toBe(0);
    expect(() => options.timeoutFor({ timeoutMs: 0 })).toThrow(LigueLeadConfigurationError);
    expect(() => options.maxRetriesFor({ maxRetries: -2 })).toThrow(LigueLeadConfigurationError);
  });
});
