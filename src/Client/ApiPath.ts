import { LigueLeadInvalidArgumentError } from '../Errors/LigueLeadInvalidArgumentError';

/**
 * A route path, built from fixed segments and ids.
 *
 * ```ts
 * ApiPath.of('campaigns').id(campaignId, 'campaignId').segment('recipients').toString()
 * // '/campaigns/2f7b3c40-…/recipients'
 * ```
 *
 * Ids are checked and encoded. An empty id would silently change the route — `GET /rcs/agents/` is
 * the list, not an agent — and `.` or `..` would climb out of it; both are refused before the
 * request is made, as is anything that is not a string or a finite number (a JavaScript caller
 * passing `undefined`).
 */
export class ApiPath {
  readonly #segments: readonly string[];

  /**
   * @param {readonly string[]} segments - Segments already safe to join.
   */
  private constructor(segments: readonly string[]) {
    this.#segments = segments;
  }

  /**
   * A path from fixed segments, written by the SDK itself (`'rcs', 'agents'`).
   *
   * @param {...string} segments - Literal segments.
   *
   * @returns {ApiPath} The path.
   */
  static of(...segments: string[]): ApiPath {
    return new ApiPath(segments);
  }

  /**
   * The path with one more fixed segment.
   *
   * @param {string} segment - A literal segment.
   *
   * @returns {ApiPath} A new path.
   */
  segment(segment: string): ApiPath {
    return new ApiPath([
      ...this.#segments,
      segment,
    ]);
  }

  /**
   * The path with an id given by the caller, checked and percent-encoded.
   *
   * @param {string | number} value - The id.
   * @param {string} name - Argument name, for the error message.
   *
   * @throws {LigueLeadInvalidArgumentError} When the id is empty, a dot segment, or not an id at all.
   *
   * @returns {ApiPath} A new path.
   */
  id(
    value: string | number,
    name: string,
  ): ApiPath {
    const text: unknown = typeof value === 'number' && Number.isFinite(value)
      ? String(value)
      : value;

    if (
      typeof text !== 'string'
      || text.trim() === ''
      || text === '.'
      || text === '..'
    ) {
      throw new LigueLeadInvalidArgumentError(`${name} must be a non-empty id`);
    }

    return new ApiPath([
      ...this.#segments,
      encodeURIComponent(text),
    ]);
  }

  /**
   * @returns {string} The path, starting with `/`.
   */
  toString(): string {
    return `/${this.#segments.join('/')}`;
  }
}
