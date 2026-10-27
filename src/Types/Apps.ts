/** An app of the client. Each app has its own `app-id` and its own webhook URL. */
export interface App {
  /** The app id, sent as the `app-id` header. */
  id: string;
  name: string;
}

/** Body of `apps.create`. */
export interface AppCreateParams {
  /** 1 to 255 characters, unique among the client's apps. */
  name: string;
}

/** Answer of `apps.delete`: the id of the app that was deactivated. */
export interface AppDeleteResult {
  id: string;
}
