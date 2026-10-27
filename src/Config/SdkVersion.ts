/**
 * Version of this SDK, sent in the `User-Agent` header and exposed as `LigueLeadClient.VERSION`.
 *
 * Kept by hand because `package.json` lives outside the compiled `rootDir`; a unit test fails when
 * the two disagree.
 */
export class SdkVersion {
  static readonly current = '1.3.2';
}
