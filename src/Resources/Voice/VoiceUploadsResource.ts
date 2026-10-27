import { ApiResource } from '../ApiResource';
import { MultipartFormBuilder } from '../../Client/MultipartFormBuilder';
import { ApiPath } from '../../Client/ApiPath';
import type { RequestOptions } from '../../Types/ClientOptions';
import type { VoiceUpload, VoiceUploadCreateParams } from '../../Types/VoiceUploads';

/** Audios for voice campaigns — `/v1/voice/uploads`. */
export class VoiceUploadsResource extends ApiResource {
  /**
   * Uploads an audio. The API checks the extension, the content type and the file's own signature,
   * and converts it to 8 kHz mono WAV.
   *
   * @param {VoiceUploadCreateParams} params - Title and file (`.wav` or `.mp3`, up to 5 MB).
   * @param {RequestOptions} [options] - Per-call options.
   *
   * @throws {LigueLeadInvalidArgumentError} When the file cannot be read or has no name.
   * @throws {LigueLeadUnsupportedMediaTypeError} When the file is not a WAV or MP3.
   * @throws {LigueLeadPayloadTooLargeError} When the file is too large.
   *
   * @returns {Promise<VoiceUpload>} The audio, with the id to send as `voice_upload_id`.
   */
  async create(
    params: VoiceUploadCreateParams,
    options?: RequestOptions,
  ): Promise<VoiceUpload> {
    const form = await new MultipartFormBuilder().addField(
      'title',
      params.title,
    ).addFile(
      'file',
      params.file,
    ).build();

    return await this.http.request<VoiceUpload>({
      method: 'POST',
      path: '/voice/uploads',
      body: form,
      auth: 'app',
      envelope: true,
      options,
    });
  }

  /**
   * Lists the app's audios, newest first — at most the latest 100.
   *
   * @param {RequestOptions} [options] - Per-call options.
   *
   * @returns {Promise<VoiceUpload[]>} The audios, possibly none.
   */
  async list(options?: RequestOptions): Promise<VoiceUpload[]> {
    return await this.http.request<VoiceUpload[]>({
      method: 'GET',
      path: '/voice/uploads',
      auth: 'app',
      envelope: true,
      options,
    });
  }

  /**
   * Reads one audio.
   *
   * @param {number | string} id - The audio id.
   * @param {RequestOptions} [options] - Per-call options.
   *
   * @throws {LigueLeadNotFoundError} When the audio does not exist or belongs to another app.
   *
   * @returns {Promise<VoiceUpload>} The audio.
   */
  async get(
    id: number | string,
    options?: RequestOptions,
  ): Promise<VoiceUpload> {
    return await this.http.request<VoiceUpload>({
      method: 'GET',
      path: ApiPath.of(
        'voice',
        'uploads',
      ).id(
        id,
        'id',
      ).toString(),
      auth: 'app',
      envelope: true,
      options,
    });
  }
}
