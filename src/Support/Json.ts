/**
 * Checks on values that came out of `JSON.parse`, shared by the transport and the webhooks.
 */
export class Json {
  /**
   * Narrows a value to a plain object.
   *
   * @param {unknown} value - Any value.
   *
   * @returns {boolean} `true` for a non-null, non-array object.
   */
  static isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
