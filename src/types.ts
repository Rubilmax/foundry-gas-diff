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
