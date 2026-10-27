import { LigueLeadNotFoundError } from '../../src';
import { RESOURCE_PREFIX, describePersistentWrites, integrationClient, silentWav } from './IntegrationClient';

const client = integrationClient();

describe('voice uploads (read-only)', () => {
  it('lists the audios, and reads the first', async () => {
    const uploads = await client.voice.uploads.list();

    expect(Array.isArray(uploads)).toBe(true);

    const [first] = uploads;

    if (first !== undefined) {
      await expect(client.voice.uploads.get(first.id)).resolves.toEqual(first);
    }
  });

  it('answers 404 for an unknown audio', async () => {
    await expect(client.voice.uploads.get(999_999_999)).rejects.toBeInstanceOf(LigueLeadNotFoundError);
  });
});

// There is no DELETE route for uploads: what this creates stays in the app.
describePersistentWrites('voice uploads (persistent writes)', () => {
  it('uploads a WAV and reads it back', async () => {
    const upload = await client.voice.uploads.create({
      title: `${RESOURCE_PREFIX}${String(Date.now())}`,
      file: { data: silentWav(), filename: 'silence.wav' },
    });

    expect(upload).toEqual({ id: expect.any(Number), title: expect.any(String), url: expect.any(String) });
    await expect(client.voice.uploads.get(upload.id)).resolves.toEqual(upload);
  });
});
