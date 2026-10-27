import { LigueLeadInvalidArgumentError, LigueLeadUnsupportedMediaTypeError } from '../../../../src/Errors';
import { appApi, createClient } from '../../Helpers/ApiMocks';

const UPLOAD = { id: 436514, title: 'Welcome', url: 'https://files.test/436514.wav' };

describe('client.voice.uploads', () => {
  it('uploads a multipart form with the title and the named, typed file', async () => {
    appApi()
      .matchHeader('content-type', /^multipart\/form-data; boundary=/)
      .matchHeader('content-length', /^\d+$/)
      .post('/v1/voice/uploads', (body: string) => (
        body.includes('name="title"\r\n\r\nWelcome\r\n')
        && body.includes('name="file"; filename="welcome.wav"\r\nContent-Type: audio/wav\r\n\r\nRIFF-fake-wave-bytes\r\n')
      ))
      .reply(201, { message: 'Voice upload successful.', data: UPLOAD });

    const upload = await createClient().voice.uploads.create({
      title: 'Welcome',
      file: { data: Buffer.from('RIFF-fake-wave-bytes'), filename: 'welcome.wav' },
    });

    expect(upload).toEqual(UPLOAD);
  });

  it('maps a file the API does not accept', async () => {
    appApi().post('/v1/voice/uploads').reply(415, { error: 'Unsupported audio format' });

    await expect(
      createClient().voice.uploads.create({ title: 'x', file: { data: Buffer.from('x'), filename: 'x.ogg' } }),
    ).rejects.toBeInstanceOf(LigueLeadUnsupportedMediaTypeError);
  });

  it('refuses a file without a name before any request', async () => {
    await expect(createClient().voice.uploads.create({ title: 'x', file: new Blob(['x']) }))
      .rejects.toBeInstanceOf(LigueLeadInvalidArgumentError);
  });

  it('lists the audios', async () => {
    appApi().get('/v1/voice/uploads').reply(200, { message: 'Voice list.', data: [UPLOAD] });

    await expect(createClient().voice.uploads.list()).resolves.toEqual([UPLOAD]);
  });

  it('lists none', async () => {
    appApi().get('/v1/voice/uploads').reply(200, { message: 'No voice found.', data: [] });

    await expect(createClient().voice.uploads.list()).resolves.toEqual([]);
  });

  it('reads one audio by numeric id', async () => {
    appApi().get('/v1/voice/uploads/436514').reply(200, { message: 'Voice found successfully.', data: UPLOAD });

    await expect(createClient().voice.uploads.get(436514)).resolves.toEqual(UPLOAD);
  });
});
