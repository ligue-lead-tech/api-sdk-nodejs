/**
 * A file encoded as the base64 data URI the API takes in `media_file`.
 *
 * ```ts
 * media_file: DataUri.fromBytes(await readFile('banner.png'), 'image/png').toString()
 * ```
 *
 * The data URI travels inside the JSON body, a third larger than the file. The template routes
 * accept a large body, but the request still crosses API Gateway and Lambda, which cap it near
 * 6 MB — for larger media, host the file and send `media_url`.
 */
export class DataUri {
  /** `data:<type>[;name=<name>];base64,<payload>`. */
  readonly value: string;

  /**
   * @param {string} value - An already encoded data URI.
   */
  private constructor(value: string) {
    this.value = value;
  }

  /**
   * Encodes a file's bytes.
   *
   * @param {Uint8Array} data - The file's bytes (a `Buffer` is a `Uint8Array`).
   * @param {string} type - Its content type (`image/png`).
   * @param {string} [name] - Optional file name, carried in the URI.
   *
   * @returns {DataUri} The data URI.
   */
  static fromBytes(
    data: Uint8Array,
    type: string,
    name?: string,
  ): DataUri {
    const nameSegment = name === undefined
      ? ''
      : `;name=${encodeURIComponent(name)}`;

    return new DataUri(`data:${type}${nameSegment};base64,${Buffer.from(data).toString('base64')}`);
  }

  /**
   * @returns {string} The data URI, ready for `media_file`.
   */
  toString(): string {
    return this.value;
  }

  /**
   * @returns {string} The data URI, so `JSON.stringify` writes it as a string.
   */
  toJSON(): string {
    return this.value;
  }
}
