import fs from "node:fs";
import { consola } from "consola";
import chalk from "chalk";
import { join } from "node:path";
import { HttpResponseContext } from "./http_context";
import { joinURL } from "ufo";
import { minimatch } from "minimatch";
import type { OverrideOption } from "../types";

export async function overrideResponse(
  ctx: HttpResponseContext,
  overrides: OverrideOption[]
) {
  const url = ctx.url;
  const cleanUrl = new URL(url);
  const searchParams = cleanUrl.search;
  cleanUrl.search = "";

  const override = overrides.reverse().find((override) => {
    return isMatch(override.urlPattern, url);
  });

  if (!override) return;

  const pattern = override.urlPattern;
  if (override.type === "mock") {
    return await ctx.fulfill({
      status: 200,
      body: override.target,
      headers: override.headers,
    });
  }
  let match = false;
  let target = "";
  const targetUrl = () => {
    const u = new URL(target);
    u.search = searchParams;
    return u.toString();
  };
  if (typeof pattern === "string") {
    const isMapping = pattern.endsWith("/");

    if (isMapping) {
      match = url.startsWith(pattern);
    } else {
      match = url === pattern;
    }

    if (match) {
      let fileName = "";
      if (isMapping) {
        fileName = cleanUrl.toString().replace(pattern, "");
      } else {
        fileName = override.target;
      }
      target =
        override.type === "remote"
          ? joinURL(override.target, fileName)
          : join(override.target, fileName);
    }
  } else {
    const path = pattern(cleanUrl.toString());
    if (path === false) return;
    if (path === true) {
      target = override.target;
    } else {
      target =
        override.type === "remote"
          ? joinURL(override.target, path)
          : join(override.target, path);
    }
  }

  if (target) {
    switch (override.type) {
      case "local": {
        switch (override.mode) {
          case "patch": {
            if (!fs.existsSync(target)) {
              return;
            }
            consola.log(
              chalk.bgGreen(" PATCH "),
              chalk.gray(url),
              chalk.green(">>>"),
              chalk.blue(target)
            );
            return ctx.fulfill({
              path: target,
            });
          }
          case "replace":
            return ctx.fulfill({
              path: target,
            });
          default:
            return;
        }
      }

      case "remote": {
        if (override.mode === "redirect") {
          return await ctx.fulfill({
            status: 302,
            headers: {
              location: targetUrl(),
            },
          });
        }

        if (override.mode === "fulfill") {
          return await ctx.fulfill({
            status: 200,
            body: target,
            headers: override.headers,
          });
        }

        const replaceResponse = await ctx.fetch({
          url: targetUrl(),
        });

        if (!replaceResponse.ok) {
          consola.warn(
            "Failed to fetch",
            targetUrl(),
            "status",
            replaceResponse.status
          );
          return;
        }

        consola.log(
          chalk.bgGreen(" PATCH "),
          chalk.gray(url),
          chalk.green(">>>"),
          chalk.blue(targetUrl())
        );
        const response = await ctx.fetch();
        return await ctx.fulfill({
          response,
          body: await replaceResponse.text(),
          contentType: replaceResponse.headers()["content-type"],
          status: replaceResponse.status(),
        });
      }
    }
  }
}

function isMatch(
  pattern: string | ((url: string) => boolean | string),
  url: string
) {
  if (typeof pattern === "function") {
    return pattern(url);
  }

  return minimatch(url, pattern);
}
