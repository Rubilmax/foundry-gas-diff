import colors from "colors";

import { DiffCell, DiffRow } from "./report";

export enum TextAlign {
  LEFT = "left",
  RIGHT = "right",
  CENTER = "center",
}

const center = (text: string, length: number) =>
  text.padStart((text.length + length) / 2).padEnd(length);

export const formatCellShell = (cell: DiffCell) => {
  const format = colors[cell.delta > 0 ? "red" : cell.delta < 0 ? "green" : "reset"];

  return [
    format((isNaN(cell.value) ? "-" : cell.value.toLocaleString()).padStart(10)),
    format(
      (isNaN(cell.delta) ? "-" : plusSign(cell.delta) + cell.delta.toLocaleString()).padStart(10)
    ),
    colors.bold(
      format(
        (isNaN(cell.prcnt) ? "-" : plusSign(cell.prcnt) + cell.prcnt.toFixed(2) + "%").padStart(8)
      )
    ),
  ];
};

export const formatDiffShell = (rows: DiffRow[]) => {
  const contractLength = Math.max(8, ...rows.map(({ contract }) => contract.length));
  const methodLength = Math.max(7, ...rows.map(({ method }) => method.length));

  const COLS = [
    { txt: "", length: 0 },
    { txt: "Contract", length: contractLength },
    { txt: "Method", length: methodLength },
    { txt: "Min", length: 34 },
    { txt: "Avg", length: 34 },
    { txt: "Median", length: 34 },
    { txt: "Max", length: 34 },
    { txt: "", length: 0 },
  ];
  const HEADER = COLS.map((entry) => colors.bold(center(entry.txt, entry.length || 0)))
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
        colors.grey(entry.contract.padEnd(contractLength)),
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

const formatCellMarkdown = (cell: DiffCell) => [
  isNaN(cell.value) ? "-" : cell.value.toLocaleString(),
  isNaN(cell.delta) ? "-" : plusSign(cell.delta) + cell.delta.toLocaleString(),
  "**" +
    (isNaN(cell.prcnt) ? "-" : plusSign(cell.prcnt) + cell.prcnt.toFixed(2) + "%") +
    "** " +
    (cell.delta > 0 ? "❌" : cell.delta < 0 ? "✅" : "➖"),
];

export const formatDiffMarkdown = (rows: DiffRow[]) => {
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
};
