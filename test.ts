import {
  test as base,
  expect,
  PlaywrightTestArgs,
  PlaywrightTestOptions,
  PlaywrightWorkerArgs,
  PlaywrightWorkerOptions,
  TestType,
} from "@playwright/test";
import { Xiaoxitian, Plugin } from "./core";

type XiaoxitianFixture = {
  xiaoxitian: Xiaoxitian;
};

type XiaoxitianOptions = {
  plugins?: Plugin[];
};

export const test: TestType<
  PlaywrightTestArgs &
    PlaywrightTestOptions &
    XiaoxitianFixture &
    XiaoxitianOptions,
  PlaywrightWorkerArgs & PlaywrightWorkerOptions
> = base.extend<XiaoxitianFixture & XiaoxitianOptions>({
  plugins: [[], { option: true }],
  xiaoxitian: async ({ context, browser, plugins }, use) => {
    const instance = new Xiaoxitian({ browser, context, plugins });
    await use(instance);
  },
});

export { expect };
