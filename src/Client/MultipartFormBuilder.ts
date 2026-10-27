import type { FileInput } from '../Types/VoiceUploads';
import { UploadFile } from './UploadFile';

/**
 * Builds a multipart form: text fields and files, in the order they were added.
 *
 * ```ts
 * const form = await new MultipartFormBuilder().addField('title', title).addFile('file', input).build();
 * ```
 */
export class MultipartFormBuilder {
  readonly #parts: ({
    name: string;
    value: string
  } | {
    name: string;
    file: FileInput
  })[] = [];

  /**
   * @param {string} name - Field name.
   * @param {string} value - Field value.
   *
   * @returns {this} The builder.
   */
  addField(
    name: string,
    value: string,
  ): this {
    this.#parts.push({
      name,
      value,
    });

    return this;
  }

  /**
   * @param {string} name - Field name.
   * @param {FileInput} input - A path, a named `Blob`, or bytes with a name.
   *
   * @returns {this} The builder.
   */
  addFile(
    name: string,
    input: FileInput,
  ): this {
    this.#parts.push({
      name,
      file: input,
    });

    return this;
  }

  /**
   * Reads the files and assembles the form.
   *
   * @throws {LigueLeadInvalidArgumentError} When a file cannot be read or has no name.
   *
   * @returns {Promise<FormData>} The form; axios serializes it with its boundary and length.
   */
  async build(): Promise<FormData> {
    const form = new FormData();

    for (const part of this.#parts) {
      if ('value' in part) {
        form.append(
          part.name,
          part.value,
        );

        continue;
      }

      const file = await UploadFile.from(part.file);

      // The three-argument form: `File` does not exist on Node 18.
      form.append(
        part.name,
        file.blob,
        file.filename,
      );
    }

    return form;
  }
}
