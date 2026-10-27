import { LigueLeadWebhookParseError, WebhookEvent } from '../../../src';
import * as fixtures from './WebhookFixtures';

type Check =
  | 'isCampaignStatus'
  | 'isSmsCampaignStatus'
  | 'isRcsCampaignStatus'
  | 'isVoiceCampaignStatus'
  | 'isVoiceAiCampaignStatus'
  | 'isRcsInboundPostback'
  | 'isSmsInbound'
  | 'isRcsAgentStatus'
  | 'isKnown';

const CHECKS: Check[] = [
  'isCampaignStatus',
  'isSmsCampaignStatus',
  'isRcsCampaignStatus',
  'isVoiceCampaignStatus',
  'isVoiceAiCampaignStatus',
  'isRcsInboundPostback',
  'isSmsInbound',
  'isRcsAgentStatus',
  'isKnown',
];

const expectations: [keyof typeof fixtures, Check[]][] = [
  ['smsStatus', ['isCampaignStatus', 'isSmsCampaignStatus', 'isKnown']],
  ['smsFlashStatus', ['isCampaignStatus', 'isSmsCampaignStatus', 'isKnown']],
  ['rcsStatus', ['isCampaignStatus', 'isRcsCampaignStatus', 'isKnown']],
  ['voiceStatus', ['isCampaignStatus', 'isVoiceCampaignStatus', 'isKnown']],
  ['voiceAiStatus', ['isCampaignStatus', 'isVoiceAiCampaignStatus', 'isKnown']],
  ['voiceAiRefusedStatus', ['isCampaignStatus', 'isVoiceAiCampaignStatus', 'isKnown']],
  ['rcsPostback', ['isRcsInboundPostback', 'isKnown']],
  ['smsInbound', ['isSmsInbound', 'isKnown']],
  ['rcsAgentStatus', ['isRcsAgentStatus', 'isKnown']],
  ['unknownEvent', []],
  ['unknownChannelStatus', []],
];

describe('WebhookEvent checks', () => {
  it.each(expectations)('recognize %s by exactly %j', (fixture, matching) => {
    const event = WebhookEvent.parse(fixtures[fixture]);

    for (const check of CHECKS) {
      expect([check, event[check]()]).toEqual([check, matching.includes(check)]);
    }
  });

  it.each([
    { event: 'campaign.status', app_id: 'a', occurred_at: 't' },
    { event: 'campaign.status', app_id: 'a', occurred_at: 't', campaign: { type: 1, status: 'delivered' } },
    { event: 'campaign.status', app_id: 'a', occurred_at: 't', campaign: { id: 'c', phone: '+55', type: 'sms' } },
    { event: 'campaign.status', app_id: 'a', occurred_at: 't', campaign: { type: 'sms', status: 'delivered' } },
    { event: 'campaign.status', app_id: 'a', occurred_at: 't', campaign: { id: 'c', type: 'sms', status: 'delivered' } },
    { event: 'rcs.inbound.postback', app_id: 'a', occurred_at: 't', campaign: {} },
    { event: 'rcs.inbound.postback', app_id: 'a', occurred_at: 't', campaign: { inbound: { type: 'postback', postback_data: 'x' } } },
    { event: 'rcs.inbound.postback', app_id: 'a', occurred_at: 't', campaign: { id: 'c', phone: '+55', type: 'sms', inbound: { type: 'postback', postback_data: 'x' } } },
    { event: 'rcs.inbound.postback', app_id: 'a', occurred_at: 't', campaign: { id: 'c', phone: '+55', type: 'rcs_single', inbound: {} } },
    { event: 'rcs.inbound.postback', app_id: 'a', occurred_at: 't', campaign: { id: 'c', phone: '+55', type: 'rcs_single', inbound: { type: 'reply', postback_data: 'x' } } },
    { event: 'sms.inbound', app_id: 'a', occurred_at: 't' },
    { event: 'sms.inbound', app_id: 'a', occurred_at: 't', campaign: { phone: '+55', message: 'SIM' } },
    { event: 'rcs.agent.status', app_id: 'a', occurred_at: 't', agent: null },
    { event: 'rcs.agent.status', app_id: 'a', occurred_at: 't', agent: { id: 'a', status: 'approved' } },
  ])('do not recognize %j', (body) => {
    expect(WebhookEvent.parse(body).isKnown()).toBe(false);
  });
});

describe('WebhookEvent.parse', () => {
  it('reads a raw string, a Buffer and a parsed object alike', () => {
    const raw = JSON.stringify(fixtures.smsStatus);

    expect(WebhookEvent.parse(raw).body).toEqual(fixtures.smsStatus);
    expect(WebhookEvent.parse(Buffer.from(raw)).body).toEqual(fixtures.smsStatus);
    expect(WebhookEvent.parse(fixtures.smsStatus).body).toBe(fixtures.smsStatus);
  });

  it('exposes the envelope', () => {
    const event = WebhookEvent.parse(fixtures.rcsAgentStatus);

    expect([event.name, event.appId, event.occurredAt]).toEqual(['rcs.agent.status', 'e3f1c2a4', '2026-10-07T12:00:15.400Z']);
  });

  it('passes an unknown event through, for the handler to ignore', () => {
    const event = WebhookEvent.parse(JSON.stringify(fixtures.unknownEvent));

    expect(event.name).toBe('whatsapp.status');
    expect(event.isKnown()).toBe(false);
  });

  it('accepts an SMS reply whose app and send could not be matched', () => {
    const event = WebhookEvent.parse({ ...fixtures.smsInbound, app_id: '', campaign: { ...fixtures.smsInbound.campaign, id: '' } });

    expect(event.appId).toBe('');
    expect(event.isSmsInbound()).toBe(true);
  });

  it('refuses a body that is not JSON, keeping the cause', () => {
    const error: unknown = (() => {
      try {
        return WebhookEvent.parse('{not json');
      } catch (thrown) {
        return thrown;
      }
    })();

    expect(error).toBeInstanceOf(LigueLeadWebhookParseError);
    expect((error as Error).cause).toBeInstanceOf(SyntaxError);
  });

  it.each([
    '[]',
    '"text"',
    { app_id: 'a', occurred_at: 't' },
    { event: '', app_id: 'a', occurred_at: 't' },
    { event: 'sms.inbound', occurred_at: 't' },
    { event: 'sms.inbound', app_id: 'a' },
  ])('refuses %j, which lacks the envelope', (body) => {
    expect(() => WebhookEvent.parse(body)).toThrow(LigueLeadWebhookParseError);
  });
});

describe('WebhookEvent delivery headers', () => {
  it('reads the id and the attempt from Node headers, whose names come lowercased', () => {
    const event = WebhookEvent.parse(fixtures.smsStatus, {
      'content-type': 'application/json',
      'x-liguelead-delivery-id': '6f1d2c3b-8a4e-4f5d-9b7c-0e1f2a3b4c5d',
      'x-liguelead-delivery-attempt': '3',
    });

    expect([event.deliveryId, event.deliveryAttempt]).toEqual(['6f1d2c3b-8a4e-4f5d-9b7c-0e1f2a3b4c5d', 3]);
  });

  it('matches the names of a plain object without regard to case, as an API Gateway REST event keeps them', () => {
    const event = WebhookEvent.parse(fixtures.smsStatus, {
      'X-LigueLead-Delivery-Id': 'd-1',
      'X-LIGUELEAD-DELIVERY-ATTEMPT': '1',
    });

    expect([event.deliveryId, event.deliveryAttempt]).toEqual(['d-1', 1]);
  });

  it('reads a Fetch Headers', () => {
    const headers = new Headers({ 'X-LigueLead-Delivery-Id': 'd-2', 'X-LigueLead-Delivery-Attempt': '2' });
    const event = WebhookEvent.parse(JSON.stringify(fixtures.rcsStatus), headers);

    expect([event.deliveryId, event.deliveryAttempt]).toEqual(['d-2', 2]);
  });

  it('takes the first value of a repeated header given as an array, trimmed', () => {
    const event = WebhookEvent.parse(fixtures.smsStatus, {
      'x-liguelead-delivery-id': [' d-3 ', 'd-4'],
      'x-liguelead-delivery-attempt': ['4'],
    });

    expect([event.deliveryId, event.deliveryAttempt]).toEqual(['d-3', 4]);
  });

  it('takes the first part of a repeated header that Node or Fetch joined with ", "', () => {
    const fetchHeaders = new Headers();

    fetchHeaders.append('X-LigueLead-Delivery-Id', 'd-3');
    fetchHeaders.append('X-LigueLead-Delivery-Id', 'd-4');
    fetchHeaders.append('X-LigueLead-Delivery-Attempt', '2');
    fetchHeaders.append('X-LigueLead-Delivery-Attempt', '2');

    const fromFetch = WebhookEvent.parse(fixtures.smsStatus, fetchHeaders);
    const fromNode = WebhookEvent.parse(fixtures.smsStatus, {
      'x-liguelead-delivery-id': 'd-3, d-4',
      'x-liguelead-delivery-attempt': '5, 5',
    });

    expect(fetchHeaders.get('X-LigueLead-Delivery-Id')).toBe('d-3, d-4');
    expect([fromFetch.deliveryId, fromFetch.deliveryAttempt]).toEqual(['d-3', 2]);
    expect([fromNode.deliveryId, fromNode.deliveryAttempt]).toEqual(['d-3', 5]);
  });

  it('reads no id from a header whose first part is blank', () => {
    const event = WebhookEvent.parse(fixtures.smsStatus, { 'x-liguelead-delivery-id': ' , d-4' });

    expect(event.deliveryId).toBeUndefined();
  });

  it('leaves both undefined without headers, or without these two', () => {
    const bare = WebhookEvent.parse(fixtures.smsStatus);
    const other = WebhookEvent.parse(fixtures.smsStatus, { 'content-type': 'application/json' });
    const fetchHeaders = WebhookEvent.parse(fixtures.smsStatus, new Headers());

    for (const event of [bare, other, fetchHeaders]) {
      expect([event.deliveryId, event.deliveryAttempt]).toEqual([undefined, undefined]);
    }
  });

  it('reads null headers, as an API Gateway console test sends them, as none', () => {
    const event = WebhookEvent.parse(fixtures.smsStatus, null);

    expect(event.body).toBe(fixtures.smsStatus);
    expect([event.deliveryId, event.deliveryAttempt]).toEqual([undefined, undefined]);
  });

  it('reads the index that Array.prototype.map passes second as no headers', () => {
    const events = [JSON.stringify(fixtures.smsStatus), JSON.stringify(fixtures.rcsStatus)].map(WebhookEvent.parse);

    expect(events.map((event) => [event.name, event.deliveryId, event.deliveryAttempt])).toEqual([
      ['campaign.status', undefined, undefined],
      ['campaign.status', undefined, undefined],
    ]);
  });

  it.each(['', '   ', '0', '-1', '1.5', '2e1', 'abc', '99999999999999999999'])(
    'reads no attempt from %j, and no id from a blank one',
    (value) => {
      const event = WebhookEvent.parse(fixtures.smsStatus, {
        'x-liguelead-delivery-id': value.trim() === '' ? value : 'd-5',
        'x-liguelead-delivery-attempt': value,
      });

      expect(event.deliveryAttempt).toBeUndefined();
      expect(event.deliveryId).toBe(value.trim() === '' ? undefined : 'd-5');
    },
  );

  it('keeps the headers out of the body, of toJSON and of deliveryKey', () => {
    const bare = WebhookEvent.parse(fixtures.smsStatus);
    const withHeaders = WebhookEvent.parse(fixtures.smsStatus, { 'x-liguelead-delivery-id': 'd-6' });

    expect(withHeaders.body).toBe(fixtures.smsStatus);
    expect(JSON.parse(JSON.stringify(withHeaders))).toEqual(fixtures.smsStatus);
    expect(withHeaders.deliveryKey()).toBe(bare.deliveryKey());
  });
});

describe('WebhookEvent.deliveryKey', () => {
  it('is the same for a retry, which carries the same body', () => {
    const first = WebhookEvent.parse(fixtures.smsStatus, { 'x-liguelead-delivery-attempt': '1' });
    const retry = WebhookEvent.parse(JSON.stringify(fixtures.smsStatus), { 'x-liguelead-delivery-attempt': '2' });

    expect(retry.deliveryKey()).toBe(first.deliveryKey());
    expect(first.deliveryKey()).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is the same for a second notification of the same status, whose occurred_at differs', () => {
    const first = WebhookEvent.parse(fixtures.smsStatus);
    const second = WebhookEvent.parse({ ...fixtures.smsStatus, occurred_at: '2026-10-07T12:05:00.000Z' });

    expect(second.deliveryKey()).toBe(first.deliveryKey());
  });

  it('differs between events of the same campaign', () => {
    const delivered = WebhookEvent.parse(fixtures.rcsStatus);
    const read = WebhookEvent.parse({ ...fixtures.rcsStatus, campaign: { ...fixtures.rcsStatus.campaign, status: 'delivered' } });

    expect(read.deliveryKey()).not.toBe(delivered.deliveryKey());
  });
});

describe('WebhookEvent.toJSON', () => {
  it('writes the body as the API sent it', () => {
    expect(JSON.parse(JSON.stringify(WebhookEvent.parse(fixtures.voiceAiStatus)))).toEqual(fixtures.voiceAiStatus);
  });
});
