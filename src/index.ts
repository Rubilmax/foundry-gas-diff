#!/usr/bin/env node

import * as fs from "fs";
import chalk from "chalk";
import commandLineArgs from "command-line-args";
import commandLineUsage from "command-line-usage";

enum TextAlign {
  LEFT = "left",
  RIGHT = "right",
  CENTER = "center",
}

interface FunctionReport {
  method: string;
  min: number;
  avg: number;
  median: number;
  max: number;
  calls: number;
}

interface ContractReport {
  name: string;
  deploymentCost: number;
  deploymentSize: number;
  functions: {
    [name: string]: FunctionReport;
  };
}

interface DiffRow {
  contract: string;
  method: string;
  min: DiffCell;
  avg: DiffCell;
  median: DiffCell;
  max: DiffCell;
}

interface DiffCell {
  value: number;
  delta: number;
  prcnt: number;
}

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

// Deduce base tx cost from the percentage denominator
const BASE_TX_COST = 21000;

// Utilities

function average(...args) {
  return args.reduce((a, b) => a + b, 0) / args.length;
}

function variation(current, previous) {
  return {
    value: current,
    delta: current - previous,
    prcnt: (100 * (current - previous)) / (previous - BASE_TX_COST),
  };
}

// Display
const center = (text: string, length: number) =>
  text.padStart((text.length + length) / 2).padEnd(length);

const plusSign = (num: number) => (num > 0 ? "+" : "");

function formatCellShell(cell: DiffCell) {
  const format = chalk[cell.delta > 0 ? "red" : cell.delta < 0 ? "green" : "reset"];
  return [
    format((isNaN(cell.value) ? "-" : cell.value.toString()).padStart(8)),
    format((isNaN(cell.delta) ? "-" : plusSign(cell.delta) + cell.delta.toString()).padStart(8)),
    format(
      (isNaN(cell.prcnt) ? "-" : plusSign(cell.prcnt) + cell.prcnt.toFixed(2) + "%").padStart(8)
    ),
  ];
}

function formatDiffShell(rows: DiffRow[]) {
  const contractLength = Math.max(8, ...rows.map(({ contract }) => contract.length));
  const methodLength = Math.max(7, ...rows.map(({ method }) => method.length));

  const COLS = [
    { txt: "", length: 0 },
    { txt: "Contract", length: contractLength },
    { txt: "Method", length: methodLength },
    { txt: "Min", length: 30 },
    { txt: "Avg", length: 30 },
    { txt: "Median", length: 30 },
    { txt: "Max", length: 30 },
    { txt: "", length: 0 },
  ];
  const HEADER = COLS.map((entry) => chalk.bold(center(entry.txt, entry.length || 0)))
    .join(" | ")
    .trim();
  const SEPARATOR = COLS.map(({ length }) => (length > 0 ? "-".repeat(length + 2) : ""))
    .join("|")
    .trim();

  return [
    "",
    HEADER,
    ...rows.map((entry) =>
      [
        "",
        chalk.grey(entry.contract.padEnd(contractLength)),
        entry.method.padEnd(methodLength),
        ...formatCellShell(entry.min),
        ...formatCellShell(entry.avg),
        ...formatCellShell(entry.median),
        ...formatCellShell(entry.max),
        "",
      ]
        .join(" | ")
        .trim()
    ),
    "",
  ]
    .join(`\n${SEPARATOR}\n`)
    .trim();
}

const alignPattern = (align = TextAlign.LEFT) => {
  switch (align) {
    case TextAlign.LEFT:
      return ":-";
    case TextAlign.RIGHT:
      return "-:";
    case TextAlign.CENTER:
      return ":-:";
  }
};

const trend = (value: number) =>
  value > 0 ? ":x:" : value < 0 ? ":heavy_check_mark:" : ":heavy_minus_sign:";

const formatCellMarkdown = (cell: DiffCell) => [
  isNaN(cell.value) ? "-" : cell.value.toString(),
  isNaN(cell.delta) ? "-" : plusSign(cell.delta) + cell.delta.toString(),
  (isNaN(cell.prcnt) ? "-" : plusSign(cell.prcnt) + cell.prcnt.toFixed(2) + "%") +
    trend(cell.delta),
];

function formatDiffMarkdown(rows: DiffRow[]) {
  const COLS = [
    { txt: "" },
    { txt: "Contract", align: TextAlign.LEFT },
    { txt: "Method", align: TextAlign.LEFT },
    { txt: "Min", align: TextAlign.RIGHT },
    { txt: "(+/-)", align: TextAlign.RIGHT },
    { txt: "%", align: TextAlign.RIGHT },
    { txt: "Avg", align: TextAlign.RIGHT },
    { txt: "(+/-)", align: TextAlign.RIGHT },
    { txt: "%", align: TextAlign.RIGHT },
    { txt: "Median", align: TextAlign.RIGHT },
    { txt: "(+/-)", align: TextAlign.RIGHT },
    { txt: "%", align: TextAlign.RIGHT },
    { txt: "Max", align: TextAlign.RIGHT },
    { txt: "(+/-)", align: TextAlign.RIGHT },
    { txt: "%", align: TextAlign.RIGHT },
    { txt: "" },
  ];

  const HEADER = COLS.map((entry) => entry.txt)
    .join(" | ")
    .trim();
  const SEPARATOR = COLS.map((entry) => (entry.txt ? alignPattern(entry.align) : ""))
    .join("|")
    .trim();

  return [
    "# Changes to gas costs",
    "",
    HEADER,
    SEPARATOR,
    rows
      .map((entry) =>
        [
          "",
          entry.contract,
          entry.method,
          ...formatCellMarkdown(entry.min),
          ...formatCellMarkdown(entry.avg),
          ...formatCellMarkdown(entry.median),
          ...formatCellMarkdown(entry.max),
          "",
        ]
          .join(" | ")
          .trim()
      )
      .join("\n"),
    "",
  ]
    .join("\n")
    .trim();
}

const loadReports = (src: string): { [name: string]: ContractReport } => {
  const content = fs.readFileSync(src, "utf8");
  const lines = content.split("\n");

  const reportHeaderIndexes = lines
    .map((line, index) => ({ isHeader: line.startsWith("╭"), index }))
    .filter(({ isHeader }) => isHeader)
    .map(({ index }) => index);

  return Object.fromEntries(
    reportHeaderIndexes
      .map((reportHeaderIndex) =>
        lines
          .slice(
            reportHeaderIndex + 1,
            reportHeaderIndex +
              lines.slice(reportHeaderIndex).findIndex((line) => line.startsWith("╰"))
          )
          .filter((line) => !line.startsWith("├") && !line.startsWith("╞"))
      )
      .map((reportLines) => {
        const [deploymentCost, deploymentSize] = reportLines[2].match(/\d+/g);

        return {
          name: reportLines[0].split(" ")[1],
          deploymentCost: parseFloat(deploymentCost),
          deploymentSize: parseFloat(deploymentSize),
          functions: Object.fromEntries(
            reportLines
              .slice(4)
              .map((line) => {
                const [method, min, avg, median, max, calls] = line.split("┆");

                return {
                  method: method.split(" ")[1],
                  min: parseFloat(min),
                  avg: parseFloat(avg),
                  median: parseFloat(median),
                  max: parseFloat(max),
                  calls: parseFloat(calls),
                };
              })
              .map((functionReport) => [functionReport.method, functionReport])
          ),
        };
      })
      .map((report) => [report.name, report])
  );
};

if (options.help) {
  console.log(
    commandLineUsage([
      {
        header: "Solidity Interfacer",
        content: "🚀🖨️  Automatically generates your Solidity contracts' interfaces",
      },
      {
        header: "Options",
        optionList: optionDefinitions,
      },
      {
        content: "Project home: {underline https://github.com/rubilmax/solidity-interfacer}",
      },
    ])
  );
} else {
  if (options.src.length < 2) throw Error("At least two different gas reports must be specfied");

  const sourceReports = loadReports(options.src[0]);
  const compareReports = loadReports(options.src[1]);

  const sourceReportNames = Object.keys(sourceReports);
  const commonReportNames = Object.keys(compareReports).filter((name) =>
    sourceReportNames.includes(name)
  );

  const diffRows = commonReportNames
    .flatMap((reportName) =>
      Object.values(sourceReports[reportName].functions).map((functionReport) => ({
        contract: reportName,
        method: functionReport.method,
        min: variation(
          compareReports[reportName].functions[functionReport.method].min,
          sourceReports[reportName].functions[functionReport.method].min
        ),
        avg: variation(
          compareReports[reportName].functions[functionReport.method].avg,
          sourceReports[reportName].functions[functionReport.method].avg
        ),
        median: variation(
          compareReports[reportName].functions[functionReport.method].median,
          sourceReports[reportName].functions[functionReport.method].median
        ),
        max: variation(
          compareReports[reportName].functions[functionReport.method].max,
          sourceReports[reportName].functions[functionReport.method].max
        ),
      }))
    )
    .filter(
      (row) =>
        row.min.delta !== 0 || row.avg.delta !== 0 || row.median.delta !== 0 || row.max.delta !== 0
    );

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
