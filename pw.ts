import { chromium, firefox, webkit } from "playwright";

const BrowserTypes = {
  chromium,
  firefox,
  webkit,
};

type BrowserType = keyof typeof BrowserTypes;

class Browser implements AsyncDisposable {
  readonly context: StartBrowserOptionContext;
  constructor(context: StartBrowserOptionContext) {
    this.context = context;
  }

  async use(
    callback: (context: StartBrowserOptionContext) => Promise<void>
  ): Promise<void> {
    await callback(this.context);
  }

  // cleanup
  async [Symbol.asyncDispose]() {
    await this.context.context.unrouteAll();
    await this.context.context.close();
    await this.context.browser.close();
  }
}

function createInstance(type: BrowserType) {
  return async function (options: StartBrowserOption): Promise<Browser> {
    const browser = await BrowserTypes[type].launch({
      timeout: 0,
      ...options.launchOptions,
    });

    const context = await browser.newContext({
      ...options.browserContextOptions,
    });

    const instance = new Browser({ browser, context });

    if (options.use) {
      instance.use(options.use);
    }

    return instance;
  };
}

export const runChromium = createInstance("chromium");
export const runFirefox = createInstance("firefox");
export const runWebkit = createInstance("webkit");

interface StartBrowserOptionContext {
  browser: import("playwright").Browser;
  context: import("playwright").BrowserContext;
}

interface StartBrowserOption {
  browserType?: "chromium" | "firefox" | "webkit";
  launchOptions?: import("playwright").LaunchOptions;
  browserContextOptions?: import("playwright").BrowserContextOptions;
  /**
   * @deprecated
   */
  use?: (context: StartBrowserOptionContext) => Promise<void>;
}
