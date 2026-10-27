/** An audio uploaded for voice campaigns. */
export interface VoiceUpload {
  /** Id to send as `voice_upload_id`. */
  id: number;
  title: string;
  /** Where the converted audio (8 kHz mono WAV) is stored. */
  url: string;
}

/** Bytes of a file, with the name the API needs to tell `.wav` from `.mp3`. */
export interface NamedFileData {
  /**
   * A `Buffer`, a `Uint8Array`, an `ArrayBuffer`, a `Blob`, or a stream of bytes
   * (`fs.createReadStream` without an encoding).
   */
  data: Blob | Uint8Array | ArrayBuffer | AsyncIterable<Uint8Array>;
  /** File name with its extension (`welcome.mp3`). */
  filename: string;
  /** Content type; derived from the extension when omitted. */
  type?: string;
}

/**
 * A file to upload: a path on disk, a `File` (or any `Blob` with a `name`), or bytes with a name.
 * Bytes without a name are not accepted — the API refuses a file whose extension it cannot see.
 */
export type FileInput = string | Blob | NamedFileData;

/** Body of `voice.uploads.create`. */
export interface VoiceUploadCreateParams {
  title: string;
  /** A `.wav` or `.mp3` file, up to 5 MB. */
  file: FileInput;
}
