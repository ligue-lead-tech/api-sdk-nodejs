/**
 * An enumeration the API may grow without a new SDK release.
 *
 * Known values still autocomplete, and an unknown one still type-checks, so a status added on the
 * server does not break the build of whoever consumes the SDK. Discriminants (`event`, `type`) are
 * never open: widening them would stop TypeScript from narrowing the union they select.
 */
export type OpenEnum<T extends string> = T | (string & {});

/** The HTTP methods the API uses. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/** One entry of a 422 validation answer: the dotted path of the field, and why it was refused. */
export interface FieldError {
  /** Dotted path of the refused field (`phones.3`), or an empty string for an unknown key. */
  field: string;
  /** The server's message, passed through unchanged. */
  message: string;
}
