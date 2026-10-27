/**
 * Base class of every error the SDK throws.
 *
 * Catching `LigueLeadError` catches all of them: API answers, transport failures and misuse of the
 * SDK itself. Each subclass sets `name` to its own class name, so logs say which one it was.
 */
export class LigueLeadError extends Error {
  /**
   * @param {string} message - Human-readable description.
   * @param {ErrorOptions} [options] - Standard error options; `cause` keeps the underlying error.
   */
  constructor(
    message: string,
    options?: ErrorOptions,
  ) {
    super(
      message,
      options,
    );

    this.name = new.target.name;
  }

  /**
   * Plain-object form for structured logs. `JSON.stringify` on an `Error` drops `message` and
   * `name`, which are the two fields a log needs most.
   *
   * @returns {Record<string, unknown>} The error's name, message and own fields.
   */
  toJSON(): Record<string, unknown> {
    return {
      ...(this as Record<string, unknown>),
      name: this.name,
      message: this.message,
    };
  }
}
