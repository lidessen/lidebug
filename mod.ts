import "disposablestack/auto";
import fs from "node:fs";
import { defu } from "defu";
import { startBrowser } from "./browser";
import { useRoute } from "./http/index";
import { useConfig } from "./config";
import type { ModifyOption, OverrideOption, RunOptions } from "./types";
import path from "node:path";

async function run(options: RunOptions, name: string) {
  const storageState = getStorageStatePath(name);

  const storageStateExists = fs.existsSync(storageState);

  const globalOptions = await readGlobalConfig();

  const mergedOptions = defu(options, globalOptions);

  await using instance = await startBrowser({
    browserType: mergedOptions.playwright?.browserType,
    launchOptions: mergedOptions.playwright?.launchOptions,
    browserContextOptions: {
      ...mergedOptions.playwright?.browserContextOptions,
      storageState:
        storageStateExists && mergedOptions.incognitoMode === false
          ? storageState
          : undefined,
    },
  });

  await instance.use(async ({ context }) => {
    const page = await context.newPage();

    if (options.initScripts) {
      for (const script of options.initScripts) {
        await context.addInitScript(script);
      }
    }

    await context.route("**", async (route, request) => {
      return useRoute({
        route,
        request,
        modifies: options.modifies,
        overrides: options.overrides,
      });
    });

    if (options.startUrl) {
      await page.goto(options.startUrl, {
        timeout: 0,
      });
    }

    await page.waitForEvent("close", {
      timeout: 0,
    });

    if (mergedOptions.incognitoMode === false) {
      await context.storageState({ path: storageState });
    }
  });
}

async function readGlobalConfig() {
  try {
    return (await import(path.resolve("./config.global"))).default;
  } catch (e) {
    console.warn("No global config found", e);
    return {};
  }
}

function getStorageStatePath(name: string) {
  return `.auth/${name}.json`;
}

export async function runApp() {
  if (!fs.existsSync(".auth")) {
    fs.mkdirSync(".auth");
  }

  if (!fs.existsSync("configs")) {
    fs.mkdirSync("configs");
  }

  const { name, data } = await useConfig();

  await run(data, name);
}

export type { ModifyOption, OverrideOption, RunOptions };
