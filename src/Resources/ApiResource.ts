import type { HttpClient } from '../Client/HttpClient';

/**
 * Base of every resource: holds the transport the client shares among them.
 */
export abstract class ApiResource {
  protected readonly http: HttpClient;

  /**
   * @param {HttpClient} http - Transport shared by the client's resources.
   */
  constructor(http: HttpClient) {
    this.http = http;
  }
}
