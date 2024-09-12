import chalk from "chalk";

/**
 * @author: chatgpt
 */
const longestCommonSubsequence = (source, target) => {
  const len1 = source.length;
  const len2 = target.length;

  const dp = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  // 填充 dp 表格，找到 LCS
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (source[i - 1] === target[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  let lcs = "";
  let i = len1,
    j = len2;
  while (i > 0 && j > 0) {
    if (source[i - 1] === target[j - 1]) {
      lcs = source[i - 1] + lcs;
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
};

const diff = (source: string, target: string) => {
  const lcs = longestCommonSubsequence(source, target);
  let result = "";

  let tgtIndex = 0,
    lcsIndex = 0;

  while (tgtIndex < target.length) {
    if (lcsIndex < lcs.length && target[tgtIndex] === lcs[lcsIndex]) {
      result += target[tgtIndex];
      tgtIndex++;
      lcsIndex++;
    } else {
      result += chalk.bgYellow(target[tgtIndex]);
      tgtIndex++;
    }
  }

  return result;
};

export const print = {
  mocked: (source: string) => {
    console.log(`${chalk.yellow("[mocked]")} ${chalk.cyan(source)}`);
  },
  modified: (source: string) => {
    console.log(`${chalk.red("[modified]")} ${chalk.cyan(source)}`);
  },
  map: (source: string, target: string) => {
    console.log(
      `${chalk.green("[proxy]")} ${chalk.cyan(source)} ${chalk.gray("=>")} ${chalk.magenta(
        diff(source, target)
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
