import nock from 'nock';
import { inspect } from 'node:util';
import { ClientOptions, LigueLeadClient, LigueLeadConfigurationError } from '../../src';
import { API_TOKEN, APP_ID, BASE_URL, ORIGIN, createClient } from './Helpers/ApiMocks';

describe('LigueLeadClient', () => {
  it('calls production by default', async () => {
    nock('https://api.liguelead.com.br').get('/v1/apps').reply(200, { data: [] });

    await new LigueLeadClient({ apiToken: API_TOKEN }).apps.list();
  });

  it('calls staging when asked', async () => {
    nock('https://homolog-api.liguelead.com.br').get('/v1/apps').reply(200, { data: [] });

    await new LigueLeadClient({ apiToken: API_TOKEN, environment: 'staging' }).apps.list();
  });

  it('calls the local API in development', async () => {
    nock('http://localhost:3008').get('/v1/apps').reply(200, { data: [] });

    await new LigueLeadClient({ apiToken: API_TOKEN, environment: 'development' }).apps.list();
  });

  it('accepts options already built', async () => {
    nock(ORIGIN, { reqheaders: { 'api-token': API_TOKEN } }).get('/v1/apps').reply(200, { data: [] });

    await new LigueLeadClient(new ClientOptions({ apiToken: API_TOKEN, baseUrl: BASE_URL })).apps.list();
  });

  it('refuses invalid options at construction', () => {
    expect(() => new LigueLeadClient({ apiToken: '' })).toThrow(LigueLeadConfigurationError);
  });

  it('derives a client with other options, leaving the original unchanged', async () => {
    const original = createClient({ appId: undefined });
    const derived = original.withOptions({ source: 'erp' });

    nock(ORIGIN, { reqheaders: { source: 'erp' } }).get('/v1/apps').reply(200, { data: [] });
    nock(ORIGIN, { badheaders: ['source'] }).get('/v1/apps').reply(200, { data: [] });

    await derived.apps.list();
    await original.apps.list();
  });

  it('validates derived options', () => {
    expect(() => createClient().withOptions({ timeoutMs: -1 })).toThrow(LigueLeadConfigurationError);
  });

  it('never shows the credentials in inspect or JSON', () => {
    const client = new LigueLeadClient({ apiToken: API_TOKEN, appId: APP_ID, baseUrl: BASE_URL });

    expect(inspect(client, { depth: 10, showHidden: true })).not.toContain(API_TOKEN);
    expect(JSON.stringify(client)).not.toContain(API_TOKEN);
  });

  it('can be awaited and logged like any object', async () => {
    const client = createClient();

    await expect(Promise.resolve(client)).resolves.toBe(client);
    expect(() => inspect(client)).not.toThrow();
  });
});
