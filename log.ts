import chalk from "chalk";

export const print = {
  map: (source: string, target: string) => {
    console.log(
      `${chalk.green("✔")} ${chalk.cyan(source)} ${chalk.gray("=>")} ${chalk.magenta(target)}`
    );
  },
};
