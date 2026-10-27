import { MultipartFormBuilder } from '../../../src/Client/MultipartFormBuilder';
import { LigueLeadInvalidArgumentError } from '../../../src/Errors';

const AUDIO = 'RIFF-fake-wave-bytes';

describe('MultipartFormBuilder', () => {
  it('puts the text fields and the named, typed files in the form, in order', async () => {
    const form = await new MultipartFormBuilder()
      .addField('title', 'Welcome')
      .addField('description', 'x')
      .addFile('file', { data: Buffer.from(AUDIO), filename: 'w.mp3' })
      .build();
    const file = form.get('file') as Blob & { name: string };

    expect([...form.keys()]).toEqual(['title', 'description', 'file']);
    expect(form.get('title')).toBe('Welcome');
    expect(file.name).toBe('w.mp3');
    expect(file.type).toBe('audio/mpeg');
    expect(Buffer.from(await file.arrayBuffer()).toString()).toBe(AUDIO);
  });

  it('keeps a file added before a field ahead of it', async () => {
    const form = await new MultipartFormBuilder()
      .addFile('file', { data: Buffer.from(AUDIO), filename: 'w.wav' })
      .addField('title', 'Welcome')
      .build();

    expect([...form.keys()]).toEqual(['file', 'title']);
  });

  it('fails the build when a file cannot be read', async () => {
    await expect(new MultipartFormBuilder().addFile('file', new Blob([AUDIO])).build())
      .rejects.toBeInstanceOf(LigueLeadInvalidArgumentError);
  });
});
