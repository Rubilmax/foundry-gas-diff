import colors from "colors";

import { DiffCell, DiffReport } from "./types";

export enum TextAlign {
  LEFT = "left",
  RIGHT = "right",
  CENTER = "center",
}

const center = (text: string, length: number) =>
  text.padStart((text.length + length) / 2).padEnd(length);

export const formatShellCell = (cell: DiffCell, length = 10) => {
  const format = colors[cell.delta > 0 ? "red" : cell.delta < 0 ? "green" : "reset"];

  return [
    cell.value.toLocaleString().padStart(length) +
      " " +
      format(("(" + (plusSign(cell.delta) + cell.delta.toLocaleString()) + ")").padEnd(length)),
    colors.bold(
      format(
        (
          plusSign(cell.prcnt) +
          (cell.prcnt === Infinity ? "∞" : cell.prcnt.toFixed(2)) +
          "%"
        ).padStart(8)
      )
    ),
  ];
};

export const formatShellDiff = (diffs: DiffReport[]) => {
  const maxContractLength = Math.max(8, ...diffs.map(({ name }) => name.length));
  const maxMethodLength = Math.max(
    7,
    ...diffs.flatMap(({ methods }) => methods.map(({ name }) => name.length))
  );

  const COLS = [
    { txt: "", length: 0 },
    { txt: "Contract", length: maxContractLength },
    { txt: "Deployment Cost (+/-)", length: 32 },
    { txt: "Method", length: maxMethodLength },
    { txt: "Min (+/-)", length: 32 },
    { txt: "Avg (+/-)", length: 32 },
    { txt: "Median (+/-)", length: 32 },
    { txt: "Max (+/-)", length: 32 },
    { txt: "# Calls (+/-)", length: 13 },
    { txt: "", length: 0 },
  ];
  const header = COLS.map((entry) => colors.bold(center(entry.txt, entry.length || 0)))
    .join(" | ")
    .trim();
  const contractSeparator = COLS.map(({ length }) => (length > 0 ? "-".repeat(length + 2) : ""))
    .join("|")
    .trim();

  return [
    "",
    header,
    ...diffs.map((diff) =>
      diff.methods
        .map((method, methodIndex) =>
          [
            "",
            colors.bold(
              colors.grey((methodIndex === 0 ? diff.name : "").padEnd(maxContractLength))
            ),
            ...(methodIndex === 0 ? formatShellCell(diff.deploymentCost) : ["".padEnd(32)]),
            colors.italic(method.name.padEnd(maxMethodLength)),
            ...formatShellCell(method.min),
            ...formatShellCell(method.avg),
            ...formatShellCell(method.median),
            ...formatShellCell(method.max),
            formatShellCell(method.calls, 6)[0],
            "",
          ]
            .join(" | ")
            .trim()
        )
        .join("\n")
        .trim()
    ),
    "",
  ]
    .join(`\n${contractSeparator}\n`)
    .trim();
};

const plusSign = (num: number) => (num > 0 ? "+" : "");

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

const formatMarkdownSummaryCell = (rows: DiffCell[]) => [
  rows
    .map(
      (row) =>
        plusSign(row.delta) +
        row.delta.toLocaleString() +
        " " +
        (row.delta > 0 ? "❌" : row.delta < 0 ? "✅" : "➖")
    )
    .join("<br />"),
  rows
    .map(
      (row) =>
        "**" + plusSign(row.prcnt) + (row.prcnt === Infinity ? "∞" : row.prcnt.toFixed(2)) + "%**"
    )
    .join("<br />"),
];

const formatMarkdownFullCell = (rows: DiffCell[]) => [
  rows
    .map(
      (row) =>
        row.value.toLocaleString() +
        "&nbsp;(" +
        plusSign(row.delta) +
        row.delta.toLocaleString() +
        ")"
    )
    .join("<br />"),
  rows
    .map(
      (row) =>
        "**" + plusSign(row.prcnt) + (row.prcnt === Infinity ? "∞" : row.prcnt.toFixed(2)) + "%**"
    )
    .join("<br />"),
];

const MARKDOWN_SUMMARY_COLS = [
  { txt: "" },
  { txt: "Contract", align: TextAlign.LEFT },
  { txt: "Method", align: TextAlign.LEFT },
  { txt: "Avg (+/-)", align: TextAlign.RIGHT },
  { txt: "%", align: TextAlign.RIGHT },
  { txt: "" },
];

const MARKDOWN_DIFF_COLS = [
  { txt: "" },
  { txt: "Contract", align: TextAlign.LEFT },
  { txt: "Deployment Cost (+/-)", align: TextAlign.RIGHT },
  { txt: "Method", align: TextAlign.LEFT },
  { txt: "Min (+/-)", align: TextAlign.RIGHT },
  { txt: "%", align: TextAlign.RIGHT },
  { txt: "Avg (+/-)", align: TextAlign.RIGHT },
  { txt: "%", align: TextAlign.RIGHT },
  { txt: "Median (+/-)", align: TextAlign.RIGHT },
  { txt: "%", align: TextAlign.RIGHT },
  { txt: "Max (+/-)", align: TextAlign.RIGHT },
  { txt: "%", align: TextAlign.RIGHT },
  { txt: "# Calls (+/-)", align: TextAlign.RIGHT },
  { txt: "" },
];

export const formatMarkdownDiff = (
  header: string,
  diffs: DiffReport[],
  repository: string,
  commitHash: string,
  refCommitHash?: string
) => {
  const summaryHeader = MARKDOWN_SUMMARY_COLS.map((entry) => entry.txt)
    .join(" | ")
    .trim();
  const summaryHeaderSeparator = MARKDOWN_SUMMARY_COLS.map((entry) =>
    entry.txt ? alignPattern(entry.align) : ""
  )
    .join("|")
    .trim();

  const diffHeader = MARKDOWN_DIFF_COLS.map((entry) => entry.txt)
    .join(" | ")
    .trim();
  const diffHeaderSeparator = MARKDOWN_DIFF_COLS.map((entry) =>
    entry.txt ? alignPattern(entry.align) : ""
  )
    .join("|")
    .trim();

  return [
    header,
    "",
    `> Generated at commit: [${commitHash}](/${repository}/commit/${commitHash})` +
      (refCommitHash
        ? `, compared to commit: [${refCommitHash}](/${repository}/commit/${refCommitHash})`
        : ""),
    "",
    "### 🧾 Summary",
    "",
    summaryHeader,
    summaryHeaderSeparator,
    diffs
      .filter((diff) => diff.methods.length > 0)
      .flatMap((diff) =>
        [
          "",
          `**${diff.name}**`,
          diff.methods.map((method) => `_${method.name}_`).join("<br />"),
          ...formatMarkdownSummaryCell(diff.methods.map((method) => method.avg)),
          "",
        ]
          .join(" | ")
          .trim()
      )
      .join("\n"),
    "---",
    "",
    "<details>",
    "<summary><strong>Full diff report</strong> 👇</summary>",
    "<br />",
    "",
    diffHeader,
    diffHeaderSeparator,
    diffs
      .flatMap((diff) =>
        [
          "",
          `**${diff.name}**`,
          formatMarkdownFullCell([diff.deploymentCost])[0],
          diff.methods.map((method) => `_${method.name}_`).join("<br />"),
          ...formatMarkdownFullCell(diff.methods.map((method) => method.min)),
          ...formatMarkdownFullCell(diff.methods.map((method) => method.avg)),
          ...formatMarkdownFullCell(diff.methods.map((method) => method.median)),
          ...formatMarkdownFullCell(diff.methods.map((method) => method.max)),
          formatMarkdownFullCell(diff.methods.map((method) => method.calls))[0],
          "",
        ]
          .join(" | ")
          .trim()
      )
      .join("\n"),
    "</details>",
    "",
  ]
    .join("\n")
    .trim();
};
