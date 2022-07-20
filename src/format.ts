import colors from "colors";

import { DiffCell, DiffReport } from "./report";

export enum TextAlign {
  LEFT = "left",
  RIGHT = "right",
  CENTER = "center",
}

const center = (text: string, length: number) =>
  text.padStart((text.length + length) / 2).padEnd(length);

export const formatShellCell = (cell: DiffCell) => {
  const format = colors[cell.delta > 0 ? "red" : cell.delta < 0 ? "green" : "reset"];

  return [
    format(cell.value.toLocaleString().padStart(10)),
    format((plusSign(cell.delta) + cell.delta.toLocaleString()).padStart(10)),
    colors.bold(format((plusSign(cell.prcnt) + cell.prcnt.toFixed(2) + "%").padStart(8))),
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
    { txt: "Method", length: maxMethodLength },
    { txt: "Min", length: 34 },
    { txt: "Avg", length: 34 },
    { txt: "Median", length: 34 },
    { txt: "Max", length: 34 },
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
            colors.italic(method.name.padEnd(maxMethodLength)),
            ...formatShellCell(method.min),
            ...formatShellCell(method.avg),
            ...formatShellCell(method.median),
            ...formatShellCell(method.max),
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
        (row.delta > 0 ? "❌" : row.delta < 0 ? "✅" : "➖")
    )
    .join("<br />"),
  rows.map((row) => "**" + plusSign(row.prcnt) + row.prcnt.toFixed(2) + "%**").join("<br />"),
];

const formatMarkdownFullCell = (rows: DiffCell[]) => [
  rows
    .map(
      (row) =>
        row.value.toLocaleString() +
        "&nbsp;(" +
        plusSign(row.delta) +
        row.delta.toLocaleString() +
        (row.delta > 0 ? "❌" : row.delta < 0 ? "✅" : "➖") +
        ")"
    )
    .join("<br />"),
  rows.map((row) => "**" + plusSign(row.prcnt) + row.prcnt.toFixed(2) + "%**").join("<br />"),
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
  { txt: "Method", align: TextAlign.LEFT },
  { txt: "Min", align: TextAlign.RIGHT },
  { txt: "%", align: TextAlign.RIGHT },
  { txt: "Avg", align: TextAlign.RIGHT },
  { txt: "%", align: TextAlign.RIGHT },
  { txt: "Median", align: TextAlign.RIGHT },
  { txt: "%", align: TextAlign.RIGHT },
  { txt: "Max", align: TextAlign.RIGHT },
  { txt: "%", align: TextAlign.RIGHT },
  { txt: "" },
];

export const formatMarkdownDiff = (title: string, diffs: DiffReport[]) => {
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
    "# " + title,
    "",
    "## Summary",
    "",
    summaryHeader,
    summaryHeaderSeparator,
    diffs
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
    "## Full diff report",
    "",
    diffHeader,
    diffHeaderSeparator,
    diffs
      .flatMap((diff) =>
        [
          "",
          `**${diff.name}**`,
          diff.methods.map((method) => `_${method.name}_`).join("<br />"),
          ...formatMarkdownFullCell(diff.methods.map((method) => method.min)),
          ...formatMarkdownFullCell(diff.methods.map((method) => method.avg)),
          ...formatMarkdownFullCell(diff.methods.map((method) => method.median)),
          ...formatMarkdownFullCell(diff.methods.map((method) => method.max)),
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
};
