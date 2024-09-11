import fs from "node:fs";
import { chromium, firefox, webkit } from "playwright";
import { CheerioAPI, load } from "cheerio";
import { globToRegex, mimetype } from "./utils";
import { print } from "./log";

const BrowserTypes = {
  chromium,
  firefox,
  webkit,
};

type BrowserType = keyof typeof BrowserTypes;

type Target = string | ((url: string) => string);

type Pattern = string | RegExp | ((url: URL) => boolean);

class Route {
  #route: import("playwright").Route;
  #fulfillResponse: FulfillResponse = {};
  #response: import("playwright").APIResponse | null = null;

  constructor(route: import("playwright").Route) {
    this.#route = route;
  }

  get request() {
    return this.#route.request.bind(this.#route);
  }

  get fulfillResponse() {
    return this.#fulfillResponse;
  }

  fetch = async (
    options?: Parameters<import("playwright").Route["fetch"]>[0]
  ) => {
    if (!this.#response && !this.#fulfillResponse.body) {
      this.#response = await this.#route.fetch(options);
      this.#fulfillResponse = {
        ...this.#fulfillResponse,
        body: await this.#response.text(),
        status: this.#response.status(),
        headers: this.#response.headers(),
      };
    }
    return this.#fulfillResponse;
  };

  async fulfill(response: FulfillResponse) {
    this.#fulfillResponse = {
      ...this.#fulfillResponse,
      ...response,
    };
  }
}

class Xiaoxitian implements AsyncDisposable {
  #browser: import("playwright").Browser;
  #context: import("playwright").BrowserContext;
  #shouldDispose = true;
  #routeMiddlewares: [Pattern, (route: Route) => void | Promise<void>][] = [];

  constructor(context: StartBrowserOptionContext) {
    this.#browser = context.browser;
    this.#context = context.context;

    this.mapLocal = this.mapLocal.bind(this);
    this.mapRemote = this.mapRemote.bind(this);
    this.mock = this.mock.bind(this);
    this.modifyJs = this.modifyJs.bind(this);
    this.modifyJson = this.modifyJson.bind(this);
    this.modifyHTML = this.modifyHTML.bind(this);
    this.open = this.open.bind(this);

    this.#context.route("**/*", async (route) => {
      const $route = new Route(route);
      for (const [pattern, middleware] of this.#routeMiddlewares) {
        const url = route.request().url();

        if (typeof pattern === "string") {
          const regex = globToRegex(pattern);
          if (regex.test(url)) {
            await middleware($route);
          }
        } else if (pattern instanceof RegExp) {
          if (pattern.test(url)) {
            await middleware($route);
          }
        } else {
          if (pattern(new URL(url))) {
            await middleware($route);
          }
        }
      }
      if ($route.fulfillResponse.body) {
        await route.fulfill(await $route.fetch());
      } else {
        await route.continue();
      }
    });

    process.on("SIGINT", () => {
      this.#shouldDispose = false;
      process.exit();
    });
  }

  addInitScript: import("playwright").BrowserContext["addInitScript"] = async (
    script
  ) => {
    await this.#context.addInitScript(script);
  };

  get pages() {
    return this.#context.pages();
  }

  async open(url: string) {
    const page = await this.#context.newPage();
    await page.goto(url);
    page.on("close", () => {
      if (this.pages.length === 0) {
        this.#context.close();
      }
    });
    return page;
  }

  #route = (url: Pattern, callback: (route: Route) => void | Promise<void>) => {
    this.#routeMiddlewares.push([url, callback]);
  };

  mock(url: Pattern, response: FulfillResponse) {
    this.#route(url, async (route) => {
      const source = route.request().url();
      print.map(source, "mocked");
      await route.fulfill(response);
    });
  }

  mapRemote(url: Pattern, target: Target) {
    this.#route(url, async (route) => {
      const source = route.request().url();
      if (typeof target === "function") {
        target = target(source);
      }
      print.map(source, target);
      await route.fetch({
        url: target,
      });
    });
  }

  mapLocal(url: Pattern, target: Target) {
    this.#route(url, async (route) => {
      const source = route.request().url();
      if (typeof target === "function") {
        target = target(source);
      }
      print.map(source, target);
      try {
        await route.fulfill({
          body: fs.readFileSync(target, "utf-8"),
          contentType: mimetype(target),
        });
      } catch (error) {
        console.warn(error.message);
      }
    });
  }

  modifyHTML(url: Pattern, callback: ($: CheerioAPI) => void) {
    this.#route(url, async (route) => {
      const source = route.request().url();
      const response = await route.fetch();
      // get contentType from response
      const contentType =
        response.contentType || response.headers["content-type"];
      if (contentType?.includes("text/html")) {
        const body = response.body;
        const $ = load(body);
        callback(load(body));
        print.map(source, "modified");
        await route.fulfill({
          body: $.html(),
          contentType,
        });
      }
    });
  }

  modifyJs(url: Pattern, callback: (source: string) => string) {
    this.#route(url, async (route) => {
      const source = route.request().url();
      const response = await route.fetch();
      // get contentType from response
      const contentType =
        response.contentType || response.headers["content-type"];
      if (contentType?.includes("application/javascript")) {
        const body = response.body as string;
        print.map(source, "modified");
        await route.fulfill({
          body: callback(body),
          contentType,
        });
      }
    });
  }

  modifyJson(url: Pattern, callback: (source: any) => any) {
    this.#route(url, async (route) => {
      const source = route.request().url();
      const response = await route.fetch();
      // get contentType from response
      const contentType =
        response.contentType || response.headers["content-type"];
      if (contentType?.includes("application/json")) {
        const body = JSON.parse(response.body as string);
        print.map(source, "modified");
        await route.fulfill({
          body: JSON.stringify(callback(body)),
          contentType,
        });
      }
    });
  }

  // cleanup
  async [Symbol.asyncDispose]() {
    if (this.#shouldDispose) {
      await this.#browser.close();
    }
  }
}

function getStorageStatePath(name: string) {
  return `~/.xiaoxitian/${name}.json`;
}

interface StartBrowserOptionContext {
  browser: import("playwright").Browser;
  context: import("playwright").BrowserContext;
}

export interface StartBrowserOption {
  name: string;
  browserType?: BrowserType;
  incognitoMode?: boolean;
  launchOptions?: import("playwright").LaunchOptions;
  browserContextOptions?: import("playwright").BrowserContextOptions;
  plugins?: Plugin[];
}

export type Plugin = (instance: Xiaoxitian) => void | Promise<void>;

type FulfillResponse = Parameters<import("playwright").Route["fulfill"]>[0];

export async function xiaoxitian(options: StartBrowserOption) {
  const storageState = getStorageStatePath(options.name);
  const storageStateExists = fs.existsSync(storageState);

  const browser = await BrowserTypes[options.browserType ?? "chromium"].launch({
    timeout: 0,
    ...options.launchOptions,
  });

  const context = await browser.newContext({
    ...options.browserContextOptions,
    storageState:
      storageStateExists && options.incognitoMode === false
        ? storageState
        : undefined,
  });

  if (options.incognitoMode === false) {
    await context.storageState({ path: storageState });
  }

  await using instance = new Xiaoxitian({ browser, context });

  for (const plugin of options.plugins ?? []) {
    await plugin(instance);
  }

  await context.waitForEvent("close", {
    timeout: 0,
  });
}
