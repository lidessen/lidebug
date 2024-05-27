import * as fs from "fs";
import { select, isCancel, cancel } from "@clack/prompts";
import path from "path";

export async function useConfig() {
  const files = fs.readdirSync("./configs");

  const options = files.map((file) => {
    return {
      value: file,
      label: file,
    };
  });

  if (options.length === 0) {
    cancel("No configs found.");
    process.exit(0);
  }

  const value = await select({
    message: "Choose a config.",
    options: options,
  });

  if (isCancel(value)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  const config = await import(path.resolve(`./configs/${value}`));

  return {
    name: value as string,
    data: config.default,
  };
}
