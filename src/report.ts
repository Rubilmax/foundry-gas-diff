import _orderBy from "lodash/orderBy";
import { Minimatch } from "minimatch";

import { DiffReport, GasReport, SortCriterion, SortOrder } from "./types";

const reportHeaderRegex = /^\| .+:.+ contract \|/;

export const variation = (current: number, previous: number) => ({
  value: current,
  delta: current - previous,
  prcnt: previous !== 0 ? (100 * (current - previous)) / previous : Infinity,
});

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
    .map((line, index) => ({ isHeader: reportHeaderRegex.test(line), index }))
    .filter(({ isHeader }) => isHeader)
    .map(({ index }) => index);

  return Object.fromEntries(
    reportHeaderIndexes
      .map((reportHeaderIndex) =>
        lines.slice(
          reportHeaderIndex,
          reportHeaderIndex + lines.slice(reportHeaderIndex).findIndex((line) => line === "")
        )
      )
      .map((reportLines) => {
        const [filePath, name] = reportLines[0].split("|")[1].trim().split(":");

        return {
          name,
          filePath,
          reportLines: reportLines.slice(3),
        };
      })
      .filter(
        matchMinimatchs
          ? ({ filePath }) => matchMinimatchs.some((minimatch) => minimatch.match(filePath))
          : ({ filePath }) => !ignoreMinimatchs.some((minimatch) => minimatch.match(filePath))
      )
      .map(({ name, filePath, reportLines }) => {
        const [deploymentCost, deploymentSize] = reportLines[0].match(/\d+/g) || [];
        if (!deploymentCost || !deploymentSize)
          throw Error("No depoyment cost or deployment size found. Is this a forge gas report?");

        return {
          name,
          filePath,
          deploymentCost: parseFloat(deploymentCost),
          deploymentSize: parseFloat(deploymentSize),
          methods: Object.fromEntries(
            reportLines
              .slice(2)
              .map((line) => {
                const [method, min, avg, median, max, calls] = line.split("|").slice(1);

                return {
                  name: method.trim(),
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

export const computeDiffs = (
  sourceReports: GasReport,
  compareReports: GasReport,
  sortCriteria: SortCriterion[],
  sortOrders: SortOrder[]
): DiffReport[] => {
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
        methods: _orderBy(
          Object.values(srcReport.methods)
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
            ),
          sortCriteria,
          sortOrders
        ),
      };
    })
    .filter(
      (diff) => diff.methods.length > 0 || diff.deploymentCost.delta !== 0
      // || diff.deploymentSize.delta !== 0 not displayed yet
    )
    .sort(
      (diff1, diff2) =>
        Math.max(...diff2.methods.map((method) => Math.abs(method.avg.prcnt))) -
        Math.max(...diff1.methods.map((method) => Math.abs(method.avg.prcnt)))
    );
};
