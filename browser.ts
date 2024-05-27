import { chromium } from "playwright";

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

  async [Symbol.asyncDispose]() {
    await this.context.context.unrouteAll();
    await this.context.context.close();
    await this.context.browser.close();
  }
}

export async function startBrowser(
  options: StartBrowserOption
): Promise<Browser> {
  const browser = await chromium.launch({
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
  launchOptions?: import("playwright").LaunchOptions;
  browserContextOptions?: import("playwright").BrowserContextOptions;
  /**
   * @deprecated
   */
  use?: (context: StartBrowserOptionContext) => Promise<void>;
}
