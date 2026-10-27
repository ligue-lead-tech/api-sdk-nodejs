import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { LigueLeadInvalidArgumentError } from '../Errors/LigueLeadInvalidArgumentError';
import type { FileInput } from '../Types/VoiceUploads';

/**
 * A file read into memory, with a name and a content type, ready to go into a form.
 *
 * Everything is buffered: the API takes at most 5 MB, the gateway buffers the body anyway, and a
 * known size lets the request carry a `Content-Length` instead of a chunked body.
 */
export class UploadFile {
  /**
   * Content types by extension. The API checks the part's type against its own list, which has
   * `audio/wav` but not `audio/x-wav` — the type many tools put on a `.wav` — so the extension wins
   * over whatever type the input carries.
   */
  static readonly EXTENSION_TYPES: Readonly<Record<string, string>> = Object.freeze({
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
  });

  readonly blob: Blob;

  readonly filename: string;

  /**
   * @param {Blob} blob - The bytes, typed.
   * @param {string} filename - The file name, extension included.
   */
  private constructor(
    blob: Blob,
    filename: string,
  ) {
    this.blob = blob;
    this.filename = filename;
  }

  /**
   * Reads a file input.
   *
   * @param {FileInput} input - A path, a named `Blob`, or bytes with a name.
   *
   * @throws {LigueLeadInvalidArgumentError} When the file cannot be read or has no name.
   *
   * @returns {Promise<UploadFile>} The file.
   */
  static async from(input: FileInput): Promise<UploadFile> {
    if (typeof input === 'string') {
      return new UploadFile(
        UploadFile.#typed(
          await UploadFile.#readPath(input),
          input,
        ),
        basename(input),
      );
    }

    if (input instanceof Blob) {
      const name = (input as Blob & { name?: unknown }).name;

      if (
        typeof name !== 'string'
        || name.trim() === ''
      ) {
        throw new LigueLeadInvalidArgumentError(
          'file is a Blob without a name: pass a File, or { data, filename } so the API can see the extension',
        );
      }

      return new UploadFile(
        UploadFile.#typed(
          input,
          name,
          input.type,
        ),
        name,
      );
    }

    if (
      typeof input.filename !== 'string'
      || input.filename.trim() === ''
    ) {
      throw new LigueLeadInvalidArgumentError('file.filename must be a non-empty file name, extension included');
    }

    return new UploadFile(
      UploadFile.#typed(
        await UploadFile.#readData(input.data),
        input.filename,
        input.type,
      ),
      input.filename,
    );
  }

  static #typed(
    data: Blob | Uint8Array,
    filename: string,
    declaredType?: string,
  ): Blob {
    const type = UploadFile.EXTENSION_TYPES[extname(filename).toLowerCase()]
      ?? (declaredType !== undefined && declaredType !== ''
        ? declaredType
        : 'application/octet-stream');

    return new Blob(
      [data],
      { type },
    );
  }

  static async #readPath(path: string): Promise<Uint8Array> {
    try {
      return await readFile(path);
    } catch (error) {
      throw new LigueLeadInvalidArgumentError(
        `file "${path}" cannot be read`,
        { cause: error },
      );
    }
  }

  static async #readData(
    data: Blob | Uint8Array | ArrayBuffer | AsyncIterable<Uint8Array>,
  ): Promise<Blob | Uint8Array> {
    if (
      data instanceof Blob
      || data instanceof Uint8Array
    ) {
      return data;
    }

    if (data instanceof ArrayBuffer) {
      return new Uint8Array(data);
    }

    const chunks: Uint8Array[] = [];

    try {
      for await (const chunk of data as AsyncIterable<unknown>) {
        // A stream with an encoding set emits text, and decoding audio as text corrupts it.
        if (!(chunk instanceof Uint8Array)) {
          throw new LigueLeadInvalidArgumentError('file.data must emit bytes: read the file without an encoding');
        }

        chunks.push(chunk);
      }
    } catch (error) {
      if (error instanceof LigueLeadInvalidArgumentError) {
        throw error;
      }

      throw new LigueLeadInvalidArgumentError(
        'file.data could not be read',
        { cause: error },
      );
    }

    return Buffer.concat(chunks);
  }
}
