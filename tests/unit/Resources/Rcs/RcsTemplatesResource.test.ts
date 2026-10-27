import { DataUri } from '../../../../src';
import { LigueLeadValidationError } from '../../../../src/Errors';
import { appApi, createClient } from '../../Helpers/ApiMocks';

const AGENT_ID = '7b3c1e90-4d2a-4f11-9c8e-2a5b6d0f3e47';
const CREATED = { id: 'tmpl_2X8', title: 'OTP', agent_id: AGENT_ID };

function created(): object {
  return { message: 'Template created successfully.', data: CREATED };
}

describe('client.rcs.templates', () => {
  it('lists the templates', async () => {
    const template = { id: 'tmpl_2X8', title: 'OTP', type: 'text', agent_id: AGENT_ID, body: 'Olá {{1}}' };

    appApi().get('/v1/rcs/templates').reply(200, { message: 'Templates retrieved successfully.', data: [template] });

    await expect(createClient().rcs.templates.list()).resolves.toEqual([template]);
  });

  it('creates a text template', async () => {
    const params = {
      agent_id: AGENT_ID,
      title: 'OTP',
      body: 'Olá {{1}}, seu código é {{2}}',
      default_variables: [{ key: '1', value: 'Cliente' }, { key: '2', value: '000000' }],
      fallback_message: 'Seu código LigueLead: 000000',
    };

    appApi().post('/v1/rcs/templates/text', params).reply(201, created());

    await expect(createClient().rcs.templates.createText(params)).resolves.toEqual(CREATED);
  });

  it('creates a media template from a file, sending the DataUri as its string', async () => {
    const media_file = DataUri.fromBytes(Buffer.from('png-bytes'), 'image/png', 'banner.png');
    const params = { agent_id: AGENT_ID, title: 'Promo', header: 'Oferta', body: 'Só hoje', media_file };

    appApi()
      .post('/v1/rcs/templates/media', { ...params, media_file: 'data:image/png;name=banner.png;base64,cG5nLWJ5dGVz' })
      .reply(201, created());

    await expect(createClient().rcs.templates.createMedia(params)).resolves.toEqual(CREATED);
  });

  it('creates a card with each kind of button', async () => {
    const params = {
      agent_id: AGENT_ID,
      title: 'Card',
      header: 'Oferta',
      body: 'Só hoje',
      media_url: 'https://cdn.example.com/a.png',
      buttons: [
        { type: 'reply' as const, title: 'Quero', postback_data: 'WANT' },
        { type: 'open_url' as const, title: 'Site', url: 'https://example.com' },
        { type: 'dial_call' as const, title: 'Ligar', phone_number: '+5511987654321' },
      ],
    };

    appApi().post('/v1/rcs/templates/card', params).reply(201, created());

    await expect(createClient().rcs.templates.createCard(params)).resolves.toEqual(CREATED);
  });

  it('creates a carousel', async () => {
    const card = { header: 'A', body: 'a', buttons: [{ type: 'reply' as const, title: 'Ver' }] };
    const params = { agent_id: AGENT_ID, title: 'Carousel', cards: [card, { ...card, header: 'B' }] };

    appApi().post('/v1/rcs/templates/carousel', params).reply(201, created());

    await expect(createClient().rcs.templates.createCarousel(params)).resolves.toEqual(CREATED);
  });

  it('passes the per-card refusal through', async () => {
    appApi()
      .post('/v1/rcs/templates/carousel')
      .reply(422, { error: [{ field: 'cards.1.buttons', message: 'Card 2 has 0 button(s) but card 1 has 1.' }] });

    const card = { header: 'A', body: 'a', buttons: [{ type: 'reply' as const, title: 'Ver' }] };
    const request = createClient().rcs.templates.createCarousel({
      agent_id: AGENT_ID,
      title: 'Carousel',
      cards: [card, { header: 'B', body: 'b', buttons: [] }],
    });

    await expect(request).rejects.toBeInstanceOf(LigueLeadValidationError);
    await expect(request).rejects.toMatchObject({ fieldErrors: [{ field: 'cards.1.buttons' }] });
  });
});
