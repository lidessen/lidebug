import chalk from "chalk";

export const print = {
  map: (source: string, target: string) => {
    console.log(
      `${chalk.green("[proxy]")} ${chalk.cyan(source)} ${chalk.gray("=>")} ${chalk.magenta(
        target
      )}`
    );
  },
  fallback: (source: string, reason?: string) => {
    console.log(
      `${chalk.gray("[fallback]")} ${chalk.yellow("⚠")} ${chalk.cyan(source)} ${
        reason ? chalk.red(reason) : ""
      }`
    );
  },
};
