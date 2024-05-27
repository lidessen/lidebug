export interface RunOptions {
  startUrl?: string;
  /**
   * default: `true`
   */
  incognitoMode?: boolean;
  initScripts?: (string | (() => void))[];
  playwright?: {
    launchOptions?: import("playwright").LaunchOptions;
    browserContextOptions?: import("playwright").BrowserContextOptions;
  };
  overrides?: OverrideOption[];
  modifies?: ModifyOption[];
}

export interface OverrideOption {
  urlPattern: string | ((url: string) => boolean | string);
  type: "local" | "remote" | "mock";
  target: string;
  mode?: "patch" | "replace" | "redirect" | "fulfill";
  headers?: Record<string, string>;
}

export type ModifyOption =
  | {
      urlPatterns: (string | RegExp)[];
      json: <T = any>(json: T) => any | Promise<any>;
    }
  | {
      urlPatterns: (string | RegExp)[];
      js: (js: string) => string | Promise<string>;
    }
  | {
      urlPatterns: (string | RegExp)[];
      html: ($: import("cheerio").CheerioAPI) => void | Promise<void>;
    };
