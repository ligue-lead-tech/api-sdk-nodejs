import type { HttpClient } from '../../Client/HttpClient';
import { VoiceUploadsResource } from './VoiceUploadsResource';

/** Voice assets. Sending a voice campaign is `campaigns.voice.send`. */
export class VoiceResource {
  /** Audios for voice campaigns — `/v1/voice/uploads`. */
  readonly uploads: VoiceUploadsResource;

  /**
   * @param {HttpClient} http - Transport shared by the client's resources.
   */
  constructor(http: HttpClient) {
    this.uploads = new VoiceUploadsResource(http);
  }
}
