import { minimatch } from "minimatch";
import { consola } from "consola";
import chalk from "chalk";
import * as cheerio from "cheerio";
import { HttpResponseContext } from "./http_context";
import { APIResponse } from "playwright";
import type { ModifyOption } from "../types";

export async function modifyResponse(
  ctx: HttpResponseContext,
  modifies: ModifyOption[]
) {
  const requestUrl = ctx.url;
  let response: {
    response: APIResponse;
    body: any;
    modified: boolean;
  } | null = null;
  for (const modify of modifies) {
    if (modify.urlPatterns.some((pattern) => isMatch(pattern, requestUrl))) {
      try {
        if (!response) {
          const res = await ctx.fetch();
          response = {
            response: res,
            body: await res.text(),
            modified: false,
          };
        }

        const body = response.body;

        if (
          "js" in modify &&
          responseType(response.response, "text/javascript")
        ) {
          response.body = await js(body, modify.js);
          response.modified = true;
          consola.log(chalk.bgGreen(`MODIFY JS`), chalk.gray(requestUrl));
        }

        if (
          "json" in modify &&
          responseType(response.response, "application/json")
        ) {
          response.body = await json(body, modify.json);
          response.modified = true;
          consola.log(chalk.bgGreen(`MODIFY JSON`), chalk.gray(requestUrl));
        }

        if ("html" in modify && responseType(response.response, "text/html")) {
          response.body = await html(body, modify.html);
          response.modified = true;
          consola.log(chalk.bgGreen(`MODIFY HTML`), chalk.gray(requestUrl));
        }

        if ("response" in modify) {
          response.response = await resp(response.response, modify.response);
          response.modified = true;
          consola.log(chalk.bgGreen(`MODIFY RESPONSE`), chalk.gray(requestUrl));
        }
      } catch (error) {
        consola.error(error);
      }
    }
  }

  if (response?.modified) {
    consola.log(chalk.bgGreen("FULFILL"), chalk.gray(requestUrl));
    return await ctx.fulfill({
      response: response.response,
      body: response.body,
    });
  }
}

function isMatch(pattern: string | RegExp, url: string) {
  if (pattern instanceof RegExp) {
    return pattern.test(url);
  }
  return minimatch(url, pattern);
}

async function html(
  body: string,
  modify: ($: import("cheerio").CheerioAPI) => void | Promise<void>
) {
  const $ = cheerio.load(body);
  await modify($);
  return $.html();
}

async function json(
  body: string,
  modify: <T = any>(json: T) => void | Promise<void>
) {
  const json = JSON.parse(body);
  return JSON.stringify(await modify(json));
}

async function js(
  body: string,
  modify: (code: string) => string | Promise<string>
) {
  return await modify(body);
}

async function resp(
  response: APIResponse,
  modify: (response: APIResponse) => APIResponse | Promise<APIResponse>
) {
  return await modify(response);
}

function responseType(response: APIResponse, type: string) {
  return response.headers()["content-type"]?.includes(type);
}
