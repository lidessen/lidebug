import { chromium, firefox, webkit } from "playwright";

const browserTypeMap = {
  chromium,
  firefox,
  webkit,
};

class Browser implements AsyncDisposable {
  readonly context: StartBrowserOptionContext;
  constructor(context: StartBrowserOptionContext) {
    this.context = context;
  }

  async use(
    callback: (context: StartBrowserOptionContext) => Promise<void>,
  ): Promise<void> {
    await callback(this.context);
  }

  async [Symbol.asyncDispose]() {
    await this.context.context.unrouteAll();
    await this.context.context.close();
    await this.context.browser.close();
  }
}

export async function startBrowser(
  options: StartBrowserOption,
): Promise<Browser> {
  const browserType = options.browserType ?? "chromium";
  const browser = await browserTypeMap[browserType].launch({
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
}

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
