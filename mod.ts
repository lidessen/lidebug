import fs from "node:fs";
import { chromium, firefox, webkit } from "playwright";
import { Xiaoxitian, Plugin } from "./core";

const BrowserTypes = {
  chromium,
  firefox,
  webkit,
};

type BrowserType = keyof typeof BrowserTypes;

function getStorageStatePath(name: string) {
  return `~/.xiaoxitian/${name}.json`;
}

export interface StartBrowserOption {
  name: string;
  browserType?: BrowserType;
  incognitoMode?: boolean;
  launchOptions?: import("playwright").LaunchOptions;
  browserContextOptions?: import("playwright").BrowserContextOptions;
  plugins?: Plugin[];
}

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

  await using instance = new Xiaoxitian({
    browser,
    context,
  });

  for (const plugin of options.plugins ?? []) {
    await plugin(instance);
  }

  process.on("SIGINT", () => {
    process.exit(0);
  });

  await context.waitForEvent("close", {
    timeout: 0,
  });
}

interface SetupOption {
  context: import("playwright").BrowserContext;
  browser: import("playwright").Browser;
  plugins?: Plugin[];
}

export function setupPlaywright({ context, browser, plugins }: SetupOption) {
  const instance = new Xiaoxitian({ context, browser });
  for (const plugin of plugins ?? []) {
    plugin(instance);
  }
  return instance;
}

export { type Plugin };
