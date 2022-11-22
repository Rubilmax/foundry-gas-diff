// import * as cp from "child_process";
import * as fs from "fs";

// import * as path from "path";
// import * as process from "process";
// import { expect, test } from "@jest/globals";
import { formatMarkdownDiff, formatShellDiff } from "../src/format";
import { loadReports, computeDiffs } from "../src/report";

const srcContent = fs.readFileSync("tests/mocks/gas_report.2.ansi", "utf8");
const cmpContent = fs.readFileSync("tests/mocks/gas_report.1.ansi", "utf8");

describe("", () => {
  // shows how the runner will run a javascript action with env / stdout protocol
  // it("should run action", () => {
  //   const np = process.execPath;
  //   const ip = path.join(__dirname, "..", "dist", "index.js");
  //   console.log(
  //     cp
  //       .execFileSync(np, [ip], {
  //         env: {
  //           ...process.env,
  //           INPUT_WORKFLOWID: "test",
  //           INPUT_BASE: "base",
  //           INPUT_HEAD: "head",
  //           GITHUB_TOKEN: "token",
  //           INPUT_REPORT: "report",
  //         },
  //       })
  //       .toString()
  //   );
  // });

  it("should compare 1 to 2 with shell format", () => {
    const loadOptions = { ignorePatterns: ["test-foundry/**/*"] };
    console.log(
      formatShellDiff(
        computeDiffs(
          loadReports(srcContent, loadOptions),
          loadReports(cmpContent, loadOptions),
          [],
          []
        )
      )
    );
  });

  it("should compare 2 to 1 with shell format", () => {
    const loadOptions = { ignorePatterns: ["**/User.sol"] };
    console.log(
      formatShellDiff(
        computeDiffs(
          loadReports(srcContent, loadOptions),
          loadReports(cmpContent, loadOptions),
          [],
          []
        )
      )
    );
  });

  it("should compare 1 to 2 with markdown format", () => {
    const loadOptions = { ignorePatterns: ["test-foundry/**/*"] };
    fs.writeFileSync(
      "tests/mocks/output.md",
      formatMarkdownDiff(
        "# Changes to gas cost",
        computeDiffs(
          loadReports(srcContent, loadOptions),
          loadReports(cmpContent, loadOptions),
          [],
          []
        ),
        "Rubilmax/foundry-gas-diff",
        "d62d23148ca73df77cd4378ee1b3c17f1f303dbf",
        undefined,
        0.9
      )
    );
  });
});
