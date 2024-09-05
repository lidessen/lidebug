import { Page, Request, Route } from "playwright";
import type { ModifyOption, OverrideOption } from "../types";

export class HttpResponseContext {
  readonly response: import("playwright").APIResponse;

  #route: Route;
  #handled = false;
  #response: import("playwright").APIResponse | null;

  constructor({ route }: RouteOptions) {
    this.#route = route;
    this.#handled = false;
  }

  get url() {
    return this.#route.request().url();
  }

  fulfill: import("playwright").Route["fulfill"] = async (response) => {
    if (this.#handled) {
      return;
    }
    this.#handled = true;
    return this.#route.fulfill(response);
  };

  continue: import("playwright").Route["continue"] = async (overrides) => {
    if (this.#handled) {
      return;
    }
    this.#handled = true;
    return this.#route.continue(overrides);
  };

  fetch: import("playwright").Route["fetch"] = async (...args) => {
    try {
      if (!this.#response) {
        this.#response = await this.#route.fetch(...args);
      }
      return this.#response;
    } catch (error) {}
  };
}

export interface RouteOptions {
  route: Route;
  request: Request;
  page?: Page;
  modifies?: ModifyOption[];
  overrides?: OverrideOption[];
}
