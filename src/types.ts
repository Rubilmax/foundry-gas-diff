import * as core from "@actions/core";

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

export interface DiffMethod {
  name: string;
  min: DiffCell;
  avg: DiffCell;
  median: DiffCell;
  max: DiffCell;
  calls: DiffCell;
}

export interface DiffReport {
  name: string;
  filePath: string;
  deploymentCost: DiffCell;
  deploymentSize: DiffCell;
  methods: DiffMethod[];
}

export interface DiffCell {
  previous: number;
  current: number;
  delta: number;
  prcnt: number;
}

export type SortCriterion = keyof DiffMethod;
export type SortOrder = "asc" | "desc";

const validSortCriteria = ["name", "min", "avg", "median", "max", "calls"] as SortCriterion[];
const validSortOrders = ["asc", "desc"] as SortOrder[];

export const isSortCriteriaValid = (sortCriteria: string[]): sortCriteria is SortCriterion[] => {
  const invalidSortCriterion = sortCriteria.find(
    (criterion) => !validSortCriteria.includes(criterion as SortCriterion)
  );
  if (invalidSortCriterion) core.setFailed(`Invalid sort criterion "${invalidSortCriterion}"`);

  return !invalidSortCriterion;
};

export const isSortOrdersValid = (sortOrders: string[]): sortOrders is SortOrder[] => {
  const invalidSortOrder = sortOrders.find(
    (order) => !validSortOrders.includes(order as SortOrder)
  );
  if (invalidSortOrder) core.setFailed(`Invalid sort order "${invalidSortOrder}"`);

  return !invalidSortOrder;
};
