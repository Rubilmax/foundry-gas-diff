import { Minimatch } from "minimatch";

export interface MethodReport {
  name: string;
  min: number;
  avg: number;
  median: number;
  max: number;
  calls: number;
}

export interface ContractReport {
  name: string;
  filePath: string;
  deploymentCost: number;
  deploymentSize: number;
  methods: {
    [name: string]: MethodReport;
  };
}

export interface GasReport {
  [name: string]: ContractReport;
}

export interface DiffReport {
  name: string;
  filePath: string;
  deploymentCost: DiffCell;
  deploymentSize: DiffCell;
  methods: {
    name: string;
    min: DiffCell;
    avg: DiffCell;
    median: DiffCell;
    max: DiffCell;
    calls: DiffCell;
  }[];
}

export interface DiffCell {
  value: number;
  delta: number;
  prcnt: number;
}

const BASE_TX_COST = 21000;

export const variation = (current: number, previous: number) => {
  return {
    value: current,
    delta: current - previous,
    prcnt: (100 * (current - previous)) / (previous - BASE_TX_COST),
  };
};

export const loadReports = (
  content: string,
  {
    ignorePatterns,
    matchPatterns,
  }: {
    ignorePatterns?: string[];
    matchPatterns?: string[];
  }
): GasReport => {
  const ignoreMinimatchs = (ignorePatterns ?? [])
    .concat(["node_modules/**/*"])
    .map((pattern) => new Minimatch(pattern));
  const matchMinimatchs = matchPatterns?.map((pattern) => new Minimatch(pattern));

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
        const [filePath, name] = reportLines[0].split(" ")[1].split(":");

        return {
          name,
          filePath,
          reportLines: reportLines.slice(1),
        };
      })
      .filter(
        matchMinimatchs
          ? ({ filePath }) => matchMinimatchs.some((minimatch) => minimatch.match(filePath))
          : ({ filePath }) => !ignoreMinimatchs.some((minimatch) => minimatch.match(filePath))
      )
      .map(({ name, filePath, reportLines }) => {
        const [deploymentCost, deploymentSize] = reportLines[1].match(/\d+/g) || [];
        if (!deploymentCost || !deploymentSize)
          throw Error("No depoyment cost or deployment size found. Is this a Foundry gas report?");

        return {
          name,
          filePath,
          deploymentCost: parseFloat(deploymentCost),
          deploymentSize: parseFloat(deploymentSize),
          methods: Object.fromEntries(
            reportLines
              .slice(3)
              .map((line) => {
                const [method, min, avg, median, max, calls] = line.split("┆");

                return {
                  name: method.split(" ")[1],
                  min: parseFloat(min),
                  avg: parseFloat(avg),
                  median: parseFloat(median),
                  max: parseFloat(max),
                  calls: parseFloat(calls),
                };
              })
              .map((methodReport) => [methodReport.name, methodReport])
          ),
        };
      })
      .map((report) => [report.name, report])
  );
};

export const computeDiffs = (sourceReports: GasReport, compareReports: GasReport): DiffReport[] => {
  const sourceReportNames = Object.keys(sourceReports);
  const commonReportNames = Object.keys(compareReports).filter((name) =>
    sourceReportNames.includes(name)
  );

  return commonReportNames
    .map((reportName) => {
      const srcReport = sourceReports[reportName];
      const cmpReport = compareReports[reportName];

      return {
        ...srcReport,
        deploymentCost: variation(cmpReport.deploymentCost, srcReport.deploymentCost),
        deploymentSize: variation(cmpReport.deploymentSize, srcReport.deploymentSize),
        methods: Object.values(srcReport.methods)
          .filter(
            (methodReport) =>
              cmpReport.methods[methodReport.name] && srcReport.methods[methodReport.name]
          )
          .map((methodReport) => ({
            ...methodReport,
            min: variation(
              cmpReport.methods[methodReport.name].min,
              srcReport.methods[methodReport.name].min
            ),
            avg: variation(
              cmpReport.methods[methodReport.name].avg,
              srcReport.methods[methodReport.name].avg
            ),
            median: variation(
              cmpReport.methods[methodReport.name].median,
              srcReport.methods[methodReport.name].median
            ),
            max: variation(
              cmpReport.methods[methodReport.name].max,
              srcReport.methods[methodReport.name].max
            ),
            calls: variation(
              cmpReport.methods[methodReport.name].calls,
              srcReport.methods[methodReport.name].calls
            ),
          }))
          .filter(
            (row) =>
              row.min.delta !== 0 ||
              row.avg.delta !== 0 ||
              row.median.delta !== 0 ||
              row.max.delta !== 0
          )
          .sort((method1, method2) => Math.abs(method2.avg.prcnt) - Math.abs(method1.avg.prcnt)),
      };
    })
    .filter(
      (diff) =>
        diff.methods.length > 0 ||
        diff.deploymentCost.delta !== 0 ||
        diff.deploymentSize.delta !== 0
    )
    .sort(
      (diff1, diff2) =>
        Math.max(...diff2.methods.map((method) => Math.abs(method.avg.prcnt))) -
        Math.max(...diff1.methods.map((method) => Math.abs(method.avg.prcnt)))
    );
};
