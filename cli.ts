#!/usr/bin/env -S pnpm tsx

import * as fs from "node:fs/promises";
import { runApp } from "./mod";
import path from "node:path";

async function init(name: string) {
  const packageJson = {
    name,
    version: "1.0.0",
    description: "",
    type: "module",
    scripts: {
      start: "debug run",
    },
    keywords: [],
    author: "",
    license: "MIT",
    devDependencies: {
      "@types/node": "^20.12.12",
      typescript: "^5.4.5",
    },
    dependencies: {
      "@lidessen/debug": "npm:@jsr/lidessen__debug@^0.1.2",
    },
    engines: {
      node: ">=20.0.0",
    },
  };

  const npmrc = `@jsr:registry=https://npm.jsr.io\n`;

  const globalConfig = `import type { RunOptions } from "@lidessen/debug";

  export default {
    playwright: {
      launchOptions: {
        headless: false,
        devtools: true,
        channel: "chrome",
      },
      browserContextOptions: {
        viewport: null,
        bypassCSP: true,
        ignoreHTTPSErrors: true,
      },
    },
  } satisfies RunOptions;`;

  const exampleConfig = `import { RunOptions } from "lidebug";

  export default {
    playwright: {
      browserContextOptions: {},
    },
    startUrl: "https://lidessen.com",
    incognitoMode: false,
    initScripts: [
      () => {
        // @ts-ignore
        import("https://lidessen.com/modifies/test.js");
      },
    ],
    modifies: [
      {
        urlPatterns: ["https://lidessen.com"],
        html($) {
          $("body").append("<button id='lidebug'>Hello lidebug</button>");
        },
      },
    ],
    overrides: [
      {
        urlPattern: "https://lidessen.com/modifies/test.js",
        type: "mock",
        target: \`window.onload = () => {
          document.querySelector("#lidebug").addEventListener("click", () => console.log("Hello lidebug"));
        }\`,
        headers: {
          "Content-Type": "application/javascript",
        },
      },
    ],
  } satisfies RunOptions;`;

  await writeFiles("package.json", JSON.stringify(packageJson, null, 2));
  await writeFiles(".npmrc", npmrc);
  await writeFiles("config.global.ts", globalConfig);
  await writeFiles("configs/example.ts", exampleConfig);
}

async function writeFiles(filePath: string, content: string) {
  // ensure the directory exists
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  // write the file
  await fs.writeFile(filePath, content);
}

import { defineCommand, runMain } from "citty";

const main = defineCommand({
  meta: {
    name: "debug",
    version: "0.1.0",
    description: "Debugging tool",
  },
  subCommands: {
    init: defineCommand({
      meta: {
        description: "Initialize a new project",
      },
      async run() {
        await init(path.basename(path.resolve("./")));
      },
    }),
    run: defineCommand({
      async run() {
        await runApp();
      },
    }),
  },
});

await runMain(main);
