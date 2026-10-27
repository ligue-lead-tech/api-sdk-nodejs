import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { UploadFile } from '../../../src/Client/UploadFile';
import { LigueLeadInvalidArgumentError } from '../../../src/Errors';

const AUDIO = 'RIFF-fake-wave-bytes';

function namedBlob(name: string, type = ''): Blob {
  return Object.assign(new Blob([AUDIO], { type }), { name });
}

async function textOf(blob: Blob): Promise<string> {
  return Buffer.from(await blob.arrayBuffer()).toString();
}

describe('UploadFile.from', () => {
  let directory: string;

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'ligue-lead-sdk-'));
  });

  afterAll(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('reads a path, naming the file after it', async () => {
    const path = join(directory, 'welcome.MP3');

    await writeFile(path, AUDIO);

    const { blob, filename } = await UploadFile.from(path);

    expect(filename).toBe('welcome.MP3');
    expect(blob.type).toBe('audio/mpeg');
    await expect(textOf(blob)).resolves.toBe(AUDIO);
  });

  it('refuses a path that cannot be read, keeping the cause', async () => {
    const error: unknown = await UploadFile.from(join(directory, 'missing.wav')).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(LigueLeadInvalidArgumentError);
    expect((error as Error).cause).toMatchObject({ code: 'ENOENT' });
  });

  it('takes the name of a File, and the extension over the declared type', async () => {
    const { blob, filename } = await UploadFile.from(namedBlob('greeting.wav', 'audio/x-wav'));

    expect(filename).toBe('greeting.wav');
    expect(blob.type).toBe('audio/wav');
    await expect(textOf(blob)).resolves.toBe(AUDIO);
  });

  it('refuses a Blob without a name, or with a blank one', async () => {
    await expect(UploadFile.from(new Blob([AUDIO]))).rejects.toThrow(LigueLeadInvalidArgumentError);
    await expect(UploadFile.from(namedBlob('   '))).rejects.toThrow(LigueLeadInvalidArgumentError);
  });

  it('refuses a stream that emits text, which would corrupt the audio', async () => {
    const text = Readable.from(['RIFF', 'WAVE']);

    await expect(UploadFile.from({ data: text, filename: 'a.wav' })).rejects.toThrow('file.data must emit bytes');
  });

  it.each([
    ['a Buffer', Buffer.from(AUDIO)],
    ['a Uint8Array', new Uint8Array(Buffer.from(AUDIO))],
    ['an ArrayBuffer', new Uint8Array(Buffer.from(AUDIO)).buffer],
    ['a Blob', new Blob([AUDIO])],
    ['a stream', Readable.from([Buffer.from('RIFF-fake'), new Uint8Array(Buffer.from('-wave-bytes'))])],
  ])('reads %s with a name', async (_label, data) => {
    const { blob, filename } = await UploadFile.from({ data, filename: 'a.wav' });

    expect(filename).toBe('a.wav');
    expect(blob.type).toBe('audio/wav');
    await expect(textOf(blob)).resolves.toBe(AUDIO);
  });

  it('uses the declared type for an extension it does not know, and octet-stream without one', async () => {
    expect((await UploadFile.from({ data: Buffer.from(AUDIO), filename: 'a.ogg', type: 'audio/ogg' })).blob.type)
      .toBe('audio/ogg');
    expect((await UploadFile.from({ data: Buffer.from(AUDIO), filename: 'a.ogg' })).blob.type)
      .toBe('application/octet-stream');
    expect((await UploadFile.from({ data: Buffer.from(AUDIO), filename: 'a.ogg', type: '' })).blob.type)
      .toBe('application/octet-stream');
  });

  it('refuses bytes without a file name', async () => {
    await expect(UploadFile.from({ data: Buffer.from(AUDIO), filename: ' ' })).rejects.toThrow(LigueLeadInvalidArgumentError);
  });

  it('refuses a stream that fails', async () => {
    const failing = new Readable({
      read() {
        this.destroy(new Error('disk gone'));
      },
    });

    await expect(UploadFile.from({ data: failing, filename: 'a.wav' })).rejects.toThrow('file.data could not be read');
  });
});

