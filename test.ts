import { test as base, expect } from "@playwright/test";
import { Xiaoxitian, Plugin } from "./core";

type XiaoxitianFixture = {
  xiaoxitian: Xiaoxitian;
};

type XiaoxitianOptions = {
  plugins?: Plugin[];
};

export const test = base.extend<XiaoxitianFixture & XiaoxitianOptions>({
  plugins: [[], { option: true }],
  xiaoxitian: async ({ context, browser, plugins }, use) => {
    const instance = new Xiaoxitian({ browser, context, plugins });
    await use(instance);
  },
});

export { expect };
