import fs from "node:fs";
import { chromium, firefox, webkit } from "playwright";
import { type CheerioAPI, load } from "cheerio";
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
    return this.#route.request.bind(
      this.#route
    ) as import("playwright").Route["request"];
  }

  get fulfillResponse() {
    return this.#fulfillResponse;
  }

  fetch = async (
    options?: Parameters<import("playwright").Route["fetch"]>[0]
  ) => {
    if (
      !this.#response &&
      !this.#fulfillResponse.body &&
      !this.#fulfillResponse.json
    ) {
      this.#response = await this.#route.fetch(options);
      this.#fulfillResponse = {
        ...this.#fulfillResponse,
        body: await this.#response.text().catch(() => undefined),
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
  #routePostMiddlewares: [Pattern, (route: Route) => void | Promise<void>][] =
    [];

  constructor(context: StartBrowserOptionContext) {
    this.#browser = context.browser;
    this.#context = context.context;

    this.mapLocal = this.mapLocal.bind(this);
    this.mapRemote = this.mapRemote.bind(this);
    this.mock = this.mock.bind(this);
    this.tap = this.tap.bind(this);
    this.modifyJs = this.modifyJs.bind(this);
    this.modifyJson = this.modifyJson.bind(this);
    this.modifyHTML = this.modifyHTML.bind(this);
    this.open = this.open.bind(this);

    this.#context.route("**/*", async (route) => {
      try {
        const $route = new Route(route);
        const url = route.request().url();
        for (const [pattern, middleware] of this.#routeMiddlewares) {
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
          const response = await route.request().response();
          response &&
            $route.fulfill({
              body: await response.text().catch(() => ""),
              status: response.status(),
              headers: response.headers(),
            });
        }
        for (const [pattern, middleware] of this.#routePostMiddlewares) {
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
      } catch (error) {
        if (error.message.includes("context or browser has been closed")) {
          return;
        }
        console.warn(error.message);
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
    try {
      await page.goto(url, {
        timeout: 0,
      });
    } catch (error) {
      console.warn(error.message);
      this.#context.close();
    }
    page.on("close", () => {
      if (this.pages.length === 0) {
        this.#context.close();
      }
    });
    return page;
  }

  #route = (
    url: Pattern,
    callback: (route: Route) => void | Promise<void>,
    options?: {
      post?: boolean;
    }
  ) => {
    if (options?.post) {
      this.#routePostMiddlewares.push([url, callback]);
    } else {
      this.#routeMiddlewares.push([url, callback]);
    }
  };

  mock(url: Pattern, response: FulfillResponse) {
    this.#route(url, async (route) => {
      const source = route.request().url();
      print.mocked(source);
      await route.fulfill(response);
    });
  }

  tap(
    url: Pattern,
    callback: (url: string, response: FulfillResponse) => void | Promise<void>
  ) {
    this.#route(
      url,
      async (route) => {
        const isJson =
          route.fulfillResponse.contentType === "application/json" ||
          route.fulfillResponse.headers?.["content-type"]?.includes(
            "application/json"
          );
        await callback(route.request().url(), {
          ...route.fulfillResponse,
          json:
            route.fulfillResponse.json || isJson
              ? JSON.parse(route.fulfillResponse.body as string)
              : undefined,
        });
      },
      {
        post: true,
      }
    );
  }

  mapRemote(url: Pattern, _target: Target, fallback?: boolean) {
    this.#route(url, async (route) => {
      let target = _target;
      const source = route.request().url();
      if (typeof target === "function") {
        target = target(source);
      }
      const response = await route.fetch({
        url: target,
      });
      if (response.status === 404 && fallback) {
        print.fallback(source);
        await route.fetch({
          url: source,
        });
      } else if (source !== target) {
        print.map(source, target);
      }
    });
  }

  mapLocal(url: Pattern, _target: Target, fallback?: boolean) {
    this.#route(url, async (route) => {
      let target = _target;
      const originalUrl = route.request().url();
      const u = new URL(originalUrl);
      u.search = "";
      const source = u.href;
      if (typeof target === "function") {
        target = target(source);
      }

      try {
        await route.fulfill({
          body: fs.readFileSync(target, "utf-8"),
          contentType: mimetype(target),
        });
        print.map(originalUrl, target);
      } catch (error) {
        if (fallback) {
          print.fallback(originalUrl, error.message);
          await route.fetch();
        }
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
        print.modified(source);
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
        print.modified(source);
        await route.fulfill({
          body: callback(body),
          contentType,
        });
      }
    });
  }

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  modifyJson(url: Pattern, callback: (source: any) => any) {
    this.#route(url, async (route) => {
      const source = route.request().url();
      const response = await route.fetch();
      // get contentType from response
      const contentType =
        response.contentType ||
        response.headers["content-type"] ||
        "application/json";
      const body = response.body
        ? JSON.parse(response.body as string)
        : response.json;
      print.modified(source);
      const json = callback(body);
      await route.fulfill({
        body: JSON.stringify(json),
        contentType,
      });
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
