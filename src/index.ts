#!/usr/bin/env node

import commandLineArgs from "command-line-args";
import commandLineUsage from "command-line-usage";
import { formatDiffMarkdown, formatDiffShell } from "./format";
import { loadReports, computeDiff } from "./report";

const optionDefinitions = [
  {
    name: "help",
    alias: "h",
    type: Boolean,
    description: "Display this usage guide.",
  },
  {
    name: "src",
    alias: "s",
    type: String,
    multiple: true,
    description: "The relative paths to convert report",
    typeLabel: "<files>",
    defaultOption: true,
    defaultValue: [],
  },
  {
    name: "output",
    alias: "o",
    type: String,
    description: "The relative paths to convert report",
    typeLabel: "<shell|markdown>",
    defaultValue: "shell",
  },
];

const options = commandLineArgs(optionDefinitions);

if (options.help) {
  console.log(
    commandLineUsage([
      {
        header: "Foundry Gas Diff",
        content: "🚀🖨️  Automatically generates your Solidity contracts' interfaces",
      },
      {
        header: "Options",
        optionList: optionDefinitions,
      },
      {
        content: "Project home: {underline https://github.com/rubilmax/foundry-gas-report}",
      },
    ])
  );
} else {
  if (options.src.length < 2) throw Error("At least two different gas reports must be specified");

  const sourceReports = loadReports(options.src[0]);
  const compareReports = loadReports(options.src[1]);
  const diffRows = computeDiff(sourceReports, compareReports);

  switch (options.output) {
    case "shell":
      console.log(formatDiffShell(diffRows));
      break;
    case "markdown":
      console.log(formatDiffMarkdown(diffRows));
      break;
    default:
      throw Error(`Unknown output format: ${options.output}`);
  }
}
