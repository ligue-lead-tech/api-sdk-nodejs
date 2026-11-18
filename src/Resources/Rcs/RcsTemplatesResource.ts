import { ApiResource } from '../ApiResource';
import type { RequestOptions } from '../../Types/ClientOptions';
import type {
  RcsCardTemplateCreateParams,
  RcsCarouselTemplateCreateParams,
  RcsMediaTemplateCreateParams,
  RcsTemplate,
  RcsTemplateCreated,
  RcsTextTemplateCreateParams,
} from '../../Types/RcsTemplates';

/**
 * RCS templates — `/v1/rcs/templates`.
 *
 * A template belongs to an agent and is sent with `campaigns.rcs.send({ template_id })`. Its
 * `fallback_message` is the SMS sent when RCS cannot be delivered.
 */
export class RcsTemplatesResource extends ApiResource {
  /**
   * Lists the app's templates.
   *
   * @param {RequestOptions} [options] - Per-call options.
   *
   * @returns {Promise<RcsTemplate[]>} The templates, possibly none.
   */
  async list(options?: RequestOptions): Promise<RcsTemplate[]> {
    return await this.http.request<RcsTemplate[]>({
      method: 'GET',
      path: '/rcs/templates',
      auth: 'app',
      envelope: true,
      options,
    });
  }

  /**
   * Creates a text template.
   *
   * @param {RcsTextTemplateCreateParams} params - Agent, title and body.
   * @param {RequestOptions} [options] - Per-call options.
   *
   * @throws {LigueLeadValidationError} When the body is refused.
   *
   * @returns {Promise<RcsTemplateCreated>} The template id, title and agent.
   */
  async createText(
    params: RcsTextTemplateCreateParams,
    options?: RequestOptions,
  ): Promise<RcsTemplateCreated> {
    return await this.#create(
      'text',
      params,
      options,
    );
  }

  /**
   * Creates a template with a header, a body and one image or video.
   *
   * @param {RcsMediaTemplateCreateParams} params - Agent, title, header, body and `media_url` or
   *   `media_file`.
   * @param {RequestOptions} [options] - Per-call options.
   *
   * @throws {LigueLeadValidationError} When the body is refused.
   * @throws {LigueLeadUnsupportedMediaTypeError} When the media is not a supported image format.
   * @throws {LigueLeadPayloadTooLargeError} When the media is too large.
   *
   * @returns {Promise<RcsTemplateCreated>} The template id, title and agent.
   */
  async createMedia(
    params: RcsMediaTemplateCreateParams,
    options?: RequestOptions,
  ): Promise<RcsTemplateCreated> {
    return await this.#create(
      'media',
      params,
      options,
    );
  }

  /**
   * Creates a rich card: an image, a header, a body and 1 to 4 buttons. The media must be an image
   * (JPEG, PNG, GIF or WEBP); the API refuses any other content on a card.
   *
   * @param {RcsCardTemplateCreateParams} params - Agent, title, header, body, buttons and
   *   `media_url` or `media_file`.
   * @param {RequestOptions} [options] - Per-call options.
   *
   * @throws {LigueLeadValidationError} When the body is refused, for example when the card has no
   *   image, a call button dials a number outside `+55`, or two reply buttons share a title.
   * @throws {LigueLeadUnsupportedMediaTypeError} When the media is not a supported image format.
   * @throws {LigueLeadPayloadTooLargeError} When the media is too large.
   *
   * @returns {Promise<RcsTemplateCreated>} The template id, title and agent.
   */
  async createCard(
    params: RcsCardTemplateCreateParams,
    options?: RequestOptions,
  ): Promise<RcsTemplateCreated> {
    return await this.#create(
      'card',
      params,
      options,
    );
  }

  /**
   * Creates a carousel of 2 to 6 cards. Every card needs an image (JPEG, PNG, GIF or WEBP; the API
   * refuses any other content), and the same number of buttons, of the same types in the same order.
   * Reply button titles must not repeat, on a card or across the cards.
   *
   * @param {RcsCarouselTemplateCreateParams} params - Agent, title and cards, each with `media_url`
   *   or `media_file`.
   * @param {RequestOptions} [options] - Per-call options.
   *
   * @throws {LigueLeadValidationError} When the body is refused, for example when there are more than
   *   6 cards, a carousel card has no image, the cards' buttons are out of step, a call button dials a
   *   number outside `+55`, or two reply buttons share a title.
   * @throws {LigueLeadUnsupportedMediaTypeError} When the media is not a supported image format.
   * @throws {LigueLeadPayloadTooLargeError} When the media is too large.
   *
   * @returns {Promise<RcsTemplateCreated>} The template id, title and agent.
   */
  async createCarousel(
    params: RcsCarouselTemplateCreateParams,
    options?: RequestOptions,
  ): Promise<RcsTemplateCreated> {
    return await this.#create(
      'carousel',
      params,
      options,
    );
  }

  async #create(
    kind: 'text' | 'media' | 'card' | 'carousel',
    params:
      | RcsTextTemplateCreateParams
      | RcsMediaTemplateCreateParams
      | RcsCardTemplateCreateParams
      | RcsCarouselTemplateCreateParams,
    options: RequestOptions | undefined,
  ): Promise<RcsTemplateCreated> {
    return await this.http.request<RcsTemplateCreated>({
      method: 'POST',
      path: `/rcs/templates/${kind}`,
      body: params,
      auth: 'app',
      envelope: true,
      options,
    });
  }
}
