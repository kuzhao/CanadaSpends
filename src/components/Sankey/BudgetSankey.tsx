"use client";

import React from "react";
import { useLingui } from "@lingui/react/macro";
import { useMemo, useState, useEffect, useCallback } from "react";
import { SankeyChart } from "./SankeyChart";
import { SankeyData } from "./SankeyChartD3";
import { Trans } from "@lingui/react/macro";
import { H2, Section, PageContent } from "@/components/Layout";
import { IS_BUDGET_2025_LIVE } from "@/lib/featureFlags";

interface SpendingReductions {
  [key: string]: number; // Department Name -> Reduction Percentage
}

type SpendingKind =
  | "program" // Normal Program Spend
  | "transfer" // Major Transfers to Provinces, Equalization, Quebec Offset, etc.
  | "debt" // Net Interest on Debt
  | "other";

interface BudgetNode {
  name: string;
  amount2024?: number;
  amount2025?: number;
  amount?: number;
  capitalShare?: number;
  kind?: SpendingKind;
  children?: BudgetNode[];
}

interface BudgetSankeyProps {
  onDataChange?: (data: {
    spending: number;
    revenue: number;
    deficit: number;
    opex2024: number;
    capex2024: number;
    opex2025: number;
    capex2025: number;
    transfers2024: number;
    transfers2025: number;
    debt2024: number;
    debt2025: number;
    other2024: number;
    other2025: number;
  }) => void;
}

// Types For Split Amounts
type SplitAmounts = {
  op2024: number;
  cap2024: number;
  op2025: number;
  cap2025: number;

  transfers2024: number;
  transfers2025: number;
  debt2024: number;
  debt2025: number;
  other2024: number;
  other2025: number;
};

// Zero SplitAmounts for Initialization
const zeroSplitAmounts: SplitAmounts = {
  op2024: 0,
  cap2024: 0,
  op2025: 0,
  cap2025: 0,
  transfers2024: 0,
  transfers2025: 0,
  debt2024: 0,
  debt2025: 0,
  other2024: 0,
  other2025: 0,
};

// Add 2 SplitAmounts Together
const addSplitAmounts = (a: SplitAmounts, b: SplitAmounts): SplitAmounts => ({
  op2024: a.op2024 + b.op2024,
  cap2024: a.cap2024 + b.cap2024,
  op2025: a.op2025 + b.op2025,
  cap2025: a.cap2025 + b.cap2025,
  transfers2024: a.transfers2024 + b.transfers2024,
  transfers2025: a.transfers2025 + b.transfers2025,
  debt2024: a.debt2024 + b.debt2024,
  debt2025: a.debt2025 + b.debt2025,
  other2024: a.other2024 + b.other2024,
  other2025: a.other2025 + b.other2025,
});

// Split a Single Leaf by capitalShare (moved outside component to prevent re-creation)
const splitLeaf = (
  amount2024: number,
  amount2025: number,
  capitalShare = 0,
): SplitAmounts => {
  const cap2024 = amount2024 * capitalShare;
  const op2024 = amount2024 - cap2024;
  const cap2025 = amount2025 * capitalShare;
  const op2025 = amount2025 - cap2025;
  return {
    ...zeroSplitAmounts,
    op2024,
    cap2024,
    op2025,
    cap2025,
  };
};

export function BudgetSankey({ onDataChange }: BudgetSankeyProps = {}) {
  const { t } = useLingui();

  // Grouped Spending Reductions (in percentages) - 9 Major Categories
  // When Budget is Live, Set All Reductions to 0% to Use Official Budget Amounts from the Government of Canada
  const [spendingReductions, setSpendingReductions] =
    useState<SpendingReductions>({
      Health: IS_BUDGET_2025_LIVE ? 0 : 7.5, // Health Research, Health Care Systems, Food Safety, Public Health
      "Public Safety": IS_BUDGET_2025_LIVE ? 0 : 7.5, // CSIS, Corrections, RCMP, Justice System, Support for Veterans
      "Social Services & Employment": IS_BUDGET_2025_LIVE ? 0 : 7.5, // Employment + Training, Housing Assistance, Gender Equality, Support for Veterans
      "Economy + Innovation & Research": IS_BUDGET_2025_LIVE ? 0 : 7.5, // Investment/Growth/Commercialization, Research, Statistics Canada, Other Boards + Councils
      "Immigration & Border Services": IS_BUDGET_2025_LIVE ? 0 : 7.5, // Border Security, Immigration Services, Settlement Assistance, Citizenship + Passports
      "Government Operations": IS_BUDGET_2025_LIVE ? 0 : 7.5, // Public Services + Procurement, Government IT, Parliament, Privy Council, Treasury Board
      "Culture & Official Languages": IS_BUDGET_2025_LIVE ? 0 : 7.5, // Official Languages + Culture
      "Revenue & Tax Administration": IS_BUDGET_2025_LIVE ? 0 : 7.5, // Revenue Canada
      "Other Federal Programs": 0, // Spending Classified as "Off-Limits to Cuts"
      "International Affairs": IS_BUDGET_2025_LIVE ? 0 : 7.5, // International Development, International Trade, International Cooperation, International Security, International Development, International Trade, International Cooperation, International Security
    });

  // Mapping From Detailed Department Names to Broader Categories
  const getDepartmentCategory = (departmentName: string): string => {
    const categoryMap: { [key: string]: string } = {
      "Health Care Systems + Protection": "Health",
      "Food Safety": "Health",
      "Public Health + Disease Prevention": "Health",
      "Health Research": "Health",

      RCMP: "Public Safety",
      Corrections: "Public Safety",
      "Justice System": "Public Safety",
      "Community Safety": "Public Safety",
      CSIS: "Public Safety",
      "Disaster Relief": "Public Safety",
      "Other Public Safety Expenses": "Public Safety",

      "Employment + Training": "Social Services & Employment",
      "Housing Assistance": "Social Services & Employment",
      "Gender Equality": "Social Services & Employment",

      "Other Immigration Services": "Immigration & Border Services",
      "Border Security": "Immigration & Border Services",
      "Settlement Assistance": "Immigration & Border Services",
      "Citizenship + Passports": "Immigration & Border Services",
      "Visitors, International Students + Temporary Workers":
        "Immigration & Border Services",
      "Interim Housing Assistance": "Immigration & Border Services",

      "Other International Affairs Activities": "International Affairs",
      "Development, Peace + Security Programming": "International Affairs",
      "Support for Embassies + Canada's Presence Abroad":
        "International Affairs",
      "International Diplomacy": "International Affairs",
      "Trade and Investment": "International Affairs",
      "International Development Research Centre": "International Affairs",

      "Investment, Growth and Commercialization":
        "Economy + Innovation & Research",
      Research: "Economy + Innovation & Research",
      "Statistics Canada": "Economy + Innovation & Research",
      "Other Boards + Councils": "Economy + Innovation & Research",
      "Infrastructure Investments": "Economy + Innovation & Research",
      "Innovative and Sustainable Natural Resources Development":
        "Economy + Innovation & Research",
      "Nuclear Labs + Decommissioning": "Economy + Innovation & Research",
      "Support for Global Competition": "Economy + Innovation & Research",
      "Natural Resources Science + Risk Mitigation":
        "Economy + Innovation & Research",
      "Other Natural Resources Management Support":
        "Economy + Innovation & Research",
      Transportation: "Economy + Innovation & Research",
      "Coastguard Operations": "Economy + Innovation & Research",
      "Fisheries + Aquatic Ecosystems": "Economy + Innovation & Research",
      "Other Fisheries Expenses": "Economy + Innovation & Research",
      Agriculture: "Economy + Innovation & Research",
      "Other Environment and Climate Change Programs":
        "Economy + Innovation & Research",
      "Weather Services": "Economy + Innovation & Research",
      "Nature Conservation": "Economy + Innovation & Research",
      "National Parks": "Economy + Innovation & Research",
      Space: "Economy + Innovation & Research",
      "Banking + Finance": "Economy + Innovation & Research",

      "Other Public Services + Procurement": "Government Operations",
      "Government IT Operations": "Government Operations",
      Parliament: "Government Operations",
      "Privy Council Office": "Government Operations",
      "Treasury Board": "Government Operations",
      "Office of the Secretary to the Governor General":
        "Government Operations",
      "Office of the Chief Electoral Officer": "Government Operations",

      "Official Languages + Culture": "Culture & Official Languages",

      "Revenue Canada": "Revenue & Tax Administration",
    };

    return categoryMap[departmentName] || "Other Federal Programs";
  };

  // Function to Calculate Total from Nested Structure
  const calculateTotal = useCallback(
    (node: BudgetNode, useProjected: boolean = true): number => {
      if (
        typeof node.amount2024 === "number" &&
        typeof node.amount2025 === "number"
      ) {
        return useProjected ? node.amount2025 : node.amount2024;
      }
      if (node.children && Array.isArray(node.children)) {
        return node.children.reduce(
          (sum: number, child: BudgetNode) =>
            sum + calculateTotal(child, useProjected),
          0,
        );
      }
      return 0;
    },
    [],
  );

  const transformNode = useCallback(
    (
      node: BudgetNode,
    ): {
      node: BudgetNode;
      sums: SplitAmounts;
    } => {
      // LEAF
      if (
        typeof node.amount2024 === "number" &&
        typeof node.amount2025 === "number"
      ) {
        const kind = node.kind ?? "program";
        const a24 = node.amount2024;
        const a25 = node.amount2025;

        if (kind === "transfer") {
          const updated: BudgetNode = { ...node, amount: a25 };
          return {
            node: updated,
            sums: {
              ...zeroSplitAmounts,
              transfers2024: a24,
              transfers2025: a25,
            },
          };
        }
        if (kind === "debt") {
          const updated: BudgetNode = { ...node, amount: a25 };
          return {
            node: updated,
            sums: { ...zeroSplitAmounts, debt2024: a24, debt2025: a25 },
          };
        }
        if (kind === "other") {
          const updated: BudgetNode = { ...node, amount: a25 };
          return {
            node: updated,
            sums: { ...zeroSplitAmounts, other2024: a24, other2025: a25 },
          };
        }

        // Program/Default: Split and Reduce Opex 2025
        const capitalShare = node.capitalShare ?? 0;
        const split = splitLeaf(a24, a25, capitalShare);

        const reductionPct =
          spendingReductions[getDepartmentCategory(node.name)] ?? 0;
        const op2025After = split.op2025 * (1 - reductionPct / 100);

        const amount2025ForChart = op2025After + split.cap2025;
        const updated: BudgetNode = { ...node, amount: amount2025ForChart };

        return {
          node: updated,
          sums: {
            ...zeroSplitAmounts,
            op2024: split.op2024,
            cap2024: split.cap2024,
            op2025: op2025After,
            cap2025: split.cap2025,
          },
        };
      }

      // PARENT
      if (node.children?.length) {
        let agg = { ...zeroSplitAmounts };
        const children: BudgetNode[] = [];

        for (const child of node.children) {
          const { node: childOut, sums } = transformNode(child);
          children.push(childOut);
          agg = addSplitAmounts(agg, sums);
        }

        const updated: BudgetNode = { ...node, children };

        return { node: updated, sums: agg };
      }

      return { node, sums: { ...zeroSplitAmounts } };
    },
    [spendingReductions],
  );

  // Function to Process Revenue Data (no reductions, just add 'amount' property)
  const processRevenueData = useCallback((node: BudgetNode): BudgetNode => {
    // Handle nodes with amount2024 and amount2025 already set
    if (
      typeof node.amount2024 === "number" &&
      typeof node.amount2025 === "number"
    ) {
      return {
        ...node,
        amount: node.amount2025, // Use 2025 amount for chart compatibility
      };
    }
    if (node.children && Array.isArray(node.children)) {
      // This is a Parent Node with Children
      return {
        ...node,
        children: node.children.map((child: BudgetNode) =>
          processRevenueData(child),
        ),
      };
    }
    return node;
  }, []);

  const data = useMemo(() => {
    const baseSpendingData = {
      name: t`Spending`,
      children: [
        {
          name: t`Economy and Standard of Living`,
          children: [
            {
              name: t`Standard of Living`,
              children: [
                {
                  name: t`Health`,
                  children: [
                    {
                      name: t`Health Research`,
                      amount2024: 1.35,
                      amount2025: 1.35,
                    },
                    {
                      name: t`Health Care Systems + Protection`,
                      amount2024: 6.85,
                      amount2025: 6.85,
                    },
                    {
                      name: t`Food Safety`,
                      amount2024: 1.08,
                      amount2025: 1.08,
                    },
                    {
                      name: t`Public Health + Disease Prevention`,
                      amount2024: 4.43,
                      amount2025: 4.43,
                    },
                  ],
                },
                {
                  name: t`Standard of Living`,
                  children: [
                    {
                      name: t`Revenue Canada`,
                      amount2024: 6.94,
                      amount2025: 6.94,
                    },
                    {
                      name: t`Employment + Training`,
                      amount2024: 28.26,
                      amount2025: 28.26,
                    },
                    {
                      name: t`Housing Assistance`,
                      amount2024: 5.43,
                      amount2025: 5.43,
                    },
                    {
                      name: t`Gender Equality`,
                      amount2024: 0.32,
                      amount2025: 0.32,
                    },
                    {
                      name: t`Official Languages + Culture`,
                      amount2024: 4.78,
                      amount2025: 4.78,
                    },
                    {
                      name: t`Support for Veterans`,
                      amount2024: 6.07,
                      amount2025: 6.07,
                      kind: "program" as SpendingKind,
                    },
                    {
                      name: t`Carbon Tax Rebate`,
                      amount2024: 9.86,
                      amount2025: 0,
                      kind: "other" as SpendingKind,
                    },
                  ],
                },
              ],
            },
            {
              name: t`Economy + Infrastructure`,
              children: [
                {
                  name: t`Innovation + Research`,
                  children: [
                    {
                      name: t`Investment, Growth and Commercialization`,
                      amount2024: 4.35,
                      amount2025: 4.35,
                    },
                    {
                      name: t`Research`,
                      amount2024: 4.11,
                      amount2025: 4.11,
                    },
                    {
                      name: t`Statistics Canada`,
                      amount2024: 0.74,
                      amount2025: 0.74,
                    },
                    {
                      name: t`Other Boards + Councils`,
                      amount2024: 0.18,
                      amount2025: 0.18,
                    },
                  ],
                },
                {
                  name: t`Community and Regional Development`,
                  children: [
                    {
                      name: t`Economic Development in Southern Ontario`,
                      amount2024: 0.46,
                      amount2025: 0.46,
                    },
                    {
                      name: t`Economic Development in Atlantic Canada`,
                      amount2024: 0.39,
                      amount2025: 0.39,
                    },
                    {
                      name: t`Economic Development in the Pacific Region`,
                      amount2024: 0.19,
                      amount2025: 0.19,
                    },
                    {
                      name: t`Western + Northern Economic Development`,
                      amount2024: 1.09,
                      amount2025: 1.09,
                    },
                    {
                      name: t`Economic Development in Northern Ontario`,
                      amount2024: 0.07,
                      amount2025: 0.07,
                    },
                    {
                      name: t`Economic Development in Quebec`,
                      amount2024: 0.39,
                      amount2025: 0.39,
                    },
                  ],
                },
                {
                  name: t`Fisheries`,
                  children: [
                    {
                      name: t`Coastguard Operations`,
                      amount2024: 1.8,
                      amount2025: 1.8,
                    },
                    {
                      name: t`Fisheries + Aquatic Ecosystems`,
                      amount2024: 1.78,
                      amount2025: 1.78,
                    },
                    {
                      name: t`Other Fisheries Expenses`,
                      amount2024: 0.97,
                      amount2025: 0.97,
                    },
                  ],
                },
                {
                  name: t`Agriculture`,
                  amount2024: 4.19,
                  amount2025: 4.19,
                },
                {
                  name: t`Space`,
                  amount2024: 0.45,
                  amount2025: 0.45,
                },
                {
                  name: t`Banking + Finance`,
                  amount2024: 0.23,
                  amount2025: 0.23,
                },
                {
                  name: t`Environment and Climate Change`,
                  children: [
                    {
                      name: t`Other Environment and Climate Change Programs`,
                      amount2024: 1.46,
                      amount2025: 1.46,
                    },
                    {
                      name: t`Weather Services`,
                      amount2024: 0.28,
                      amount2025: 0.28,
                    },
                    {
                      name: t`Nature Conservation`,
                      amount2024: 0.72,
                      amount2025: 0.72,
                    },
                    {
                      name: t`National Parks`,
                      amount2024: 1.45,
                      amount2025: 1.45,
                    },
                  ],
                },
                {
                  name: t`Natural Resources Management`,
                  children: [
                    {
                      name: t`Innovative and Sustainable Natural Resources Development`,
                      amount2024: 1.911,
                      amount2025: 1.911,
                    },
                    {
                      name: t`Support for Global Competition`,
                      amount2024: 0.874,
                      amount2025: 0.874,
                    },
                    {
                      name: t`Nuclear Labs + Decommissioning`,
                      amount2024: 1.514,
                      amount2025: 1.514,
                    },
                    {
                      name: t`Natural Resources Science + Risk Mitigation`,
                      amount2024: 0.452,
                      amount2025: 0.452,
                    },
                    {
                      name: t`Other Natural Resources Management Support`,
                      amount2024: 0.344,
                      amount2025: 0.344,
                    },
                  ],
                },
                {
                  name: t`Infrastructure Investments`,
                  amount2024: 9.02,
                  amount2025: 9.02,
                  capitalShare: 1.0,
                  kind: "program" as SpendingKind,
                },
                {
                  name: t`Transportation`,
                  amount2024: 5.31,
                  amount2025: 5.31,
                },
              ],
            },
          ],
        },
        {
          name: t`Social Security`,
          children: [
            {
              name: t`Retirement Benefits`,
              amount2024: 76.03,
              amount2025: 76.03,
              kind: "transfer" as SpendingKind,
            },
            {
              name: t`Employment Insurance`,
              amount2024: 23.13,
              amount2025: 23.13,
              kind: "transfer" as SpendingKind,
            },
            {
              name: t`Children's Benefits`,
              amount2024: 26.34,
              amount2025: 26.55,
              kind: "transfer" as SpendingKind,
            },
            {
              name: t`COVID-19 Income Support`,
              amount2024: -4.84,
              amount2025: 0,
              kind: "transfer" as SpendingKind,
            },
            {
              name: t`Canada Emergency Wage Subsidy`,
              amount2024: -0.42,
              amount2025: 0,
              kind: "transfer" as SpendingKind,
            },
          ],
        },
        {
          name: t`New Spending`,
          children: [
            {
              name: t`Strategic Response Fund`,
              amount2024: 0,
              amount2025: 5,
              capitalShare: 1.0,
              kind: "program" as SpendingKind,
            },
            {
              name: t`Regional Tariff Response Initiative`,
              amount2024: 0,
              amount2025: 1,
              capitalShare: 1.0,
              kind: "program" as SpendingKind,
            },
            {
              name: t`Biofuel Production Incentive`,
              amount2024: 0,
              amount2025: 0.37,
              capitalShare: 1.0,
              kind: "program" as SpendingKind,
            },
            {
              name: t`Build Canada Homes`,
              amount2024: 0,
              amount2025: 13,
              capitalShare: 1.0,
              kind: "program" as SpendingKind,
            },
          ],
        },
        {
          name: t`Safety`,
          children: [
            {
              name: t`Public Safety`,
              children: [
                {
                  name: t`CSIS`,
                  amount2024: 0.83,
                  amount2025: 0.83,
                },
                {
                  name: t`Corrections`,
                  amount2024: 3.374,
                  amount2025: 3.374,
                },
                {
                  name: t`RCMP`,
                  amount2024: 5.14,
                  amount2025: 5.14,
                },
                {
                  name: t`Disaster Relief`,
                  amount2024: 0.52,
                  amount2025: 0.52,
                },
                {
                  name: t`Community Safety`,
                  amount2024: 0.839,
                  amount2025: 0.839,
                },
                {
                  name: t`Office of the Chief Electoral Officer`,
                  amount2024: 0.249,
                  amount2025: 0.249,
                },
                {
                  name: t`Other Public Safety Expenses`,
                  amount2024: 0.269,
                  amount2025: 0.269,
                },
                {
                  name: t`Justice System`,
                  amount2024: 2.442,
                  amount2025: 2.442,
                },
              ],
            },
            {
              name: t`Immigration + Border Security`,
              children: [
                {
                  name: t`Border Security`,
                  amount2024: 2.69,
                  amount2025: 2.82,
                },
                {
                  name: t`Other Immigration Services`,
                  amount2024: 3.389,
                  amount2025: 3.389,
                },
                {
                  name: t`Settlement Assistance`,
                  amount2024: 1.926,
                  amount2025: 1.926,
                },
                {
                  name: t`Interim Housing Assistance`,
                  amount2024: 0.26,
                  amount2025: 0.26,
                },
                {
                  name: t`Visitors, International Students + Temporary Workers`,
                  amount2024: 0.52,
                  amount2025: 0.52,
                },
                {
                  name: t`Citizenship + Passports`,
                  amount2024: 0.24,
                  amount2025: 0.24,
                },
              ],
            },
          ],
        },
        {
          name: t`Other`,
          children: [
            {
              name: t`Public Works + Government Services`,
              children: [
                {
                  name: t`Other Public Services + Procurement`,
                  amount2024: 5.388,
                  amount2025: 5.388,
                },
                {
                  name: t`Government IT Operations`,
                  amount2024: 2.7,
                  amount2025: 2.7,
                },
              ],
            },
            {
              name: t`Functioning of Government`,
              children: [
                {
                  name: t`Parliament`,
                  amount2024: 0.93,
                  amount2025: 0.93,
                },
                {
                  name: t`Privy Council Office`,
                  amount2024: 0.347,
                  amount2025: 0.347,
                },
                {
                  name: t`Treasury Board`,
                  amount2024: 4.954,
                  amount2025: 4.954,
                },
                {
                  name: t`Office of the Secretary to the Governor General`,
                  amount2024: 0.026,
                  amount2025: 0.026,
                },
              ],
            },
            {
              name: t`Net actuarial losses`,
              amount2024: -7.49,
              amount2025: -7.49,
              kind: "other" as SpendingKind,
            },
          ],
        },
        {
          name: t`Transfers to Provinces`,
          link: "https://www.canada.ca/en/department-finance/programs/federal-transfers/major-federal-transfers.html",
          children: [
            {
              name: t`Health Transfer to Provinces`,
              children: [
                {
                  name: t`Newfoundland and Labrador HTP`,
                  amount2024: 0.666,
                  amount2025: 0.666,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`Prince Edward Island HTP`,
                  amount2024: 0.214,
                  amount2025: 0.214,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`Nova Scotia HTP`,
                  amount2024: 1.303,
                  amount2025: 1.303,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`New Brunswick HTP`,
                  amount2024: 1.027,
                  amount2025: 1.027,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`Quebec HTP`,
                  amount2024: 10.911,
                  amount2025: 10.911,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`Ontario HTP`,
                  amount2024: 19.266,
                  amount2025: 19.266,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`Manitoba HTP`,
                  amount2024: 1.794,
                  amount2025: 1.794,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`Saskatchewan HTP`,
                  amount2024: 1.491,
                  amount2025: 1.491,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`Alberta HTP`,
                  amount2024: 5.771,
                  amount2025: 5.771,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`British Columbia HTP`,
                  amount2024: 6.817,
                  amount2025: 6.817,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`Yukon HTP`,
                  amount2024: 0.056,
                  amount2025: 0.056,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`Northwest Territories HTP`,
                  amount2024: 0.055,
                  amount2025: 0.055,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`Nunavut HTP`,
                  amount2024: 0.05,
                  amount2025: 0.05,
                  kind: "transfer" as SpendingKind,
                },
              ],
            },
            {
              name: t`Social Transfer to Provinces`,
              children: [
                {
                  name: t`Newfoundland and Labrador STP`,
                  amount2024: 0.221,
                  amount2025: 0.221,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`Prince Edward Island STP`,
                  amount2024: 0.071,
                  amount2025: 0.071,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`Nova Scotia STP`,
                  amount2024: 0.433,
                  amount2025: 0.433,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`New Brunswick STP`,
                  amount2024: 0.341,
                  amount2025: 0.341,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`Quebec STP`,
                  amount2024: 3.624,
                  amount2025: 3.624,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`Ontario STP`,
                  amount2024: 6.4,
                  amount2025: 6.4,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`Manitoba STP`,
                  amount2024: 0.596,
                  amount2025: 0.596,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`Saskatchewan STP`,
                  amount2024: 0.495,
                  amount2025: 0.495,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`Alberta STP`,
                  amount2024: 1.917,
                  amount2025: 1.917,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`British Columbia STP`,
                  amount2024: 2.264,
                  amount2025: 2.264,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`Yukon STP`,
                  amount2024: 0.019,
                  amount2025: 0.019,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`Northwest Territories STP`,
                  amount2024: 0.018,
                  amount2025: 0.018,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`Nunavut STP`,
                  amount2024: 0.017,
                  amount2025: 0.017,
                  kind: "transfer" as SpendingKind,
                },
              ],
            },
            {
              name: t`Equalization Payments to Provinces`,
              children: [
                {
                  name: t`Newfoundland and Labrador EQP`,
                  amount2024: 0,
                  amount2025: 0,
                },
                {
                  name: t`Prince Edward Island EQP`,
                  amount2024: 0.561,
                  amount2025: 0.561,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`Nova Scotia EQP`,
                  amount2024: 2.803,
                  amount2025: 2.803,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`New Brunswick EQP`,
                  amount2024: 2.631,
                  amount2025: 2.631,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`Quebec EQP`,
                  amount2024: 14.037,
                  amount2025: 14.037,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`Ontario EQP`,
                  amount2024: 0.421,
                  amount2025: 0.421,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`Manitoba EQP`,
                  amount2024: 3.51,
                  amount2025: 3.51,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`Saskatchewan EQP`,
                  amount2024: 0,
                  amount2025: 0,
                },
                {
                  name: t`Alberta EQP`,
                  amount2024: 0,
                  amount2025: 0,
                },
                {
                  name: t`British Columbia EQP`,
                  amount2024: 0,
                  amount2025: 0,
                },
                {
                  name: t`Yukon EQP`,
                  amount2024: 0,
                  amount2025: 0,
                },
                {
                  name: t`Northwest Territories EQP`,
                  amount2024: 0,
                  amount2025: 0,
                },
                {
                  name: t`Nunavut EQP`,
                  amount2024: 0,
                  amount2025: 0,
                },
              ],
            },
            {
              name: t`Quebec Tax Offset`,
              amount2024: -7.1,
              amount2025: -7.1,
              kind: "transfer" as SpendingKind,
            },
            {
              name: t`Other Major Transfers`,
              amount2024: 17.6,
              amount2025: 17.6,
              kind: "transfer" as SpendingKind,
            },
          ],
        },
        {
          name: t`Obligations`,
          children: [
            {
              name: t`Net Interest on Debt`,
              amount2024: 47.27,
              amount2025: 47.27,
              kind: "debt" as SpendingKind,
            },
          ],
        },
        {
          name: t`Defence`,
          children: [
            {
              name: t`Ready Forces`,
              amount2024: 13.368,
              amount2025: 16.368,
              kind: "program" as SpendingKind,
            },
            {
              name: t`Defence Procurement`,
              amount2024: 4.93,
              amount2025: 7.93,
              capitalShare: 1.0,
              kind: "program" as SpendingKind,
            },
            {
              name: t`Sustainable Bases, IT Systems, Infrastructure`,
              amount2024: 4.913,
              amount2025: 4.913,
              capitalShare: 1.0,
              kind: "program" as SpendingKind,
            },
            {
              name: t`Defence Team`,
              amount2024: 5.39,
              amount2025: 8.09,
              kind: "program" as SpendingKind,
            },
            {
              name: t`Future Force Design`,
              amount2024: 1.472,
              amount2025: 1.472,
              kind: "program" as SpendingKind,
            },
            {
              name: t`Defence Operations + Internal Services`,
              amount2024: 3.39,
              amount2025: 3.39,
              kind: "program" as SpendingKind,
            },
            {
              name: t`Communications Security Establishment`,
              amount2024: 1.01,
              amount2025: 1.01,
              kind: "program" as SpendingKind,
            },
            {
              name: t`Other Defence`,
              amount2024: 0.01,
              amount2025: 0.01,
              kind: "program" as SpendingKind,
            },
          ],
        },
        {
          name: t`Indigenous Priorities`,
          children: [
            {
              name: t`Indigenous Well-Being + Self Determination`,
              children: [
                {
                  name: t`Grants to Support the New Fiscal Relationship with First Nations`,
                  amount2024: 1.36,
                  amount2025: 1.36,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`Community Infrastructure Grants`,
                  amount2024: 3.31,
                  amount2025: 3.31,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`First Nations Elementary and Secondary Educational Advancement`,
                  amount2024: 2.56,
                  amount2025: 2.56,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`On-reserve Income Support in Yukon Territory`,
                  amount2024: 1.4,
                  amount2025: 1.4,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`First Nations and Inuit Health Infrastructure Support`,
                  amount2024: 1.22,
                  amount2025: 1.22,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`Emergency Management Activities On-Reserve`,
                  amount2024: 0.59,
                  amount2025: 0.59,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`Prevention and Protection Services for Children, Youth, Families and Communities`,
                  amount2024: 3.57,
                  amount2025: 3.57,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`First Nations and Inuit Primary Health Care`,
                  amount2024: 3.03,
                  amount2025: 3.03,
                  kind: "transfer" as SpendingKind,
                },
                {
                  name: t`Other Support for Indigenous Well-Being`,
                  amount2024: 9.45,
                  amount2025: 9.45,
                  kind: "transfer" as SpendingKind,
                },
              ],
            },
            {
              name: t`Crown-Indigenous Relations`,
              children: [
                {
                  name: t`Claims Settlements`,
                  children: [
                    {
                      name: t`Out of Court Settlement`,
                      amount2024: 5.0,
                      amount2025: 0,
                      kind: "other" as SpendingKind,
                    },
                    {
                      name: t`Gottfriedson Band Class Settlement`,
                      amount2024: 2.82,
                      amount2025: 0,
                      kind: "other" as SpendingKind,
                    },
                    {
                      name: t`Childhood Claims Settlement`,
                      amount2024: 1.42,
                      amount2025: 0,
                      kind: "other" as SpendingKind,
                    },
                    {
                      name: t`Other Settlement Agreements`,
                      amount2024: 0.85,
                      amount2025: 0,
                      kind: "other" as SpendingKind,
                    },
                  ],
                },
                {
                  name: t`Other Grants and Contributions to Support Crown-Indigenous Relations`,
                  amount2024: 6.26,
                  amount2025: 6.26,
                  kind: "other" as SpendingKind,
                },
              ],
            },
          ],
        },
        {
          name: t`International Affairs`,
          children: [
            {
              name: t`Development, Peace + Security Programming`,
              amount2024: 5.37,
              amount2025: 5.37,
            },
            {
              name: t`International Diplomacy`,
              amount2024: 1.0,
              amount2025: 1.0,
            },
            {
              name: t`International Development Research Centre`,
              amount2024: 0.16,
              amount2025: 0.16,
            },
            {
              name: t`Support for Embassies + Canada's Presence Abroad`,
              amount2024: 1.23,
              amount2025: 1.23,
            },
            {
              name: t`Other International Affairs Activities`,
              amount2024: 11.03,
              amount2025: 11.03,
            },
            {
              name: t`Trade and Investment`,
              amount2024: 0.41,
              amount2025: 0.41,
            },
          ],
        },
      ],
    };

    const revenueData = {
      name: t`Revenue`,
      children: [
        {
          name: t`Other Taxes and Duties`,
          children: [
            {
              name: t`Goods and Services Tax`,
              amount2024: 51.42,
              amount2025: 51.42,
            },
            {
              name: t`Energy Taxes`,
              children: [
                {
                  name: t`Excise Tax — Gasoline`,
                  amount2024: 4.33,
                  amount2025: 4.33,
                },
                {
                  name: t`Excise Tax - Diesel Fuel`,
                  amount2024: 1.12,
                  amount2025: 1.12,
                },
                {
                  name: t`Excise Tax — Aviation Gasoline and Jet Fuel`,
                  amount2024: 0.14,
                  amount2025: 0.14,
                },
              ],
            },
            {
              name: t`Customs Duties`,
              amount2024: 5.57,
              amount2025: 5.57,
            },
            {
              name: t`Other Excise Taxes and Duties`,
              children: [
                {
                  name: t`Excise Duties`,
                  amount2024: 5.33,
                  amount2025: 5.33,
                },
                {
                  name: t`Air Travellers Charge`,
                  amount2024: 1.5,
                  amount2025: 1.5,
                },
              ],
            },
          ],
        },
        {
          name: t`Individual Income Taxes`,
          amount2024: 217.7,
          amount2025: 212.3,
        },
        {
          name: t`Corporate Income Taxes`,
          amount2024: 82.47,
          amount2025: 82.47,
        },
        {
          name: t`Non-resident Income Taxes`,
          amount2024: 12.54,
          amount2025: 12.54,
        },
        {
          name: t`Payroll Taxes`,
          children: [
            {
              name: t`Employment Insurance Premiums`,
              amount2024: 29.56,
              amount2025: 29.56,
            },
          ],
        },
        {
          name: t`Carbon Tax Revenue`,
          amount2024: 9.86,
          amount2025: 0,
        },
        {
          name: t`Other Non-tax Revenue`,
          children: [
            {
              name: t`Crown Corporations and other government business enterprises`,
              amount2024: 3.22,
              amount2025: 3.22,
            },
            {
              name: t`Net Foreign Exchange Revenue`,
              amount2024: 3.4,
              amount2025: 3.4,
            },
            {
              name: t`Return on Investments`,
              amount2024: 0.88,
              amount2025: 0.88,
            },
            {
              name: t`Sales of Government Goods + Services`,
              amount2024: 13.99,
              amount2025: 13.99,
            },
            {
              name: t`Miscellaneous revenues`,
              amount2024: 15.87,
              amount2025: 15.87,
            },
          ],
        },
      ],
    };

    // Transform Spending Tree With Operational/Capital Split
    const { node: spendingOut, sums } = transformNode(baseSpendingData);

    // Compute Top-Level Spending Totals
    const op2024 = sums.op2024;
    const cap2024 = sums.cap2024;
    const op2025 = sums.op2025;
    const cap2025 = sums.cap2025;

    const transfers2024 = sums.transfers2024;
    const transfers2025 = sums.transfers2025;
    const debt2024 = sums.debt2024;
    const debt2025 = sums.debt2025;
    const other2024 = sums.other2024;
    const other2025 = sums.other2025;

    const totalSpending2024 =
      op2024 + cap2024 + transfers2024 + debt2024 + other2024;
    const totalSpending2025 =
      op2025 + cap2025 + transfers2025 + debt2025 + other2025;

    const processedRevenue = processRevenueData(revenueData);
    const revenue2025 = calculateTotal(processedRevenue, true);

    // Preserve What Sankey Expects
    const totalForChart = Math.max(totalSpending2025, revenue2025);

    return JSON.parse(
      JSON.stringify({
        total: totalForChart,
        spending: totalSpending2025,
        revenue: revenue2025,
        deficit: totalSpending2025 - revenue2025,
        spending_data: spendingOut,
        revenue_data: processedRevenue,
        baseline_spending: totalSpending2024,

        // NEW: expose all spending categories
        opex2024: op2024,
        capex2024: cap2024,
        opex2025: op2025,
        capex2025: cap2025,
        transfers2024: transfers2024,
        transfers2025: transfers2025,
        debt2024: debt2024,
        debt2025: debt2025,
        other2024: other2024,
        other2025: other2025,
      }),
    );
  }, [t, transformNode, calculateTotal, processRevenueData]);

  // Notify Parent Component of Data Changes (using useEffect to avoid setState during render)
  useEffect(() => {
    if (onDataChange && data) {
      onDataChange({
        spending: data.spending,
        revenue: data.revenue,
        deficit: data.spending - data.revenue,
        opex2024: data.opex2024,
        capex2024: data.capex2024,
        opex2025: data.opex2025,
        capex2025: data.capex2025,
        transfers2024: data.transfers2024,
        transfers2025: data.transfers2025,
        debt2024: data.debt2024,
        debt2025: data.debt2025,
        other2024: data.other2024,
        other2025: data.other2025,
      });
    }
  }, [data, onDataChange]);

  // Function to Update Spending Reduction for a Specific Category
  const updateSpendingReduction = (category: string, reduction: number) => {
    setSpendingReductions((prev) => ({
      ...prev,
      [category]: reduction,
    }));
  };

  return (
    <div>
      {/* Sankey Chart */}
      <SankeyChart data={data as SankeyData} />

      {/* Spending Reduction Controls - Only Show When Budget is Not Live */}
      {!IS_BUDGET_2025_LIVE && (
        <PageContent>
          <Section>
            <H2 className="text-white">
              <Trans>Department Spending Reductions</Trans>
            </H2>
            <div className="mt-6 p-4 bg-blue-900 rounded-lg">
              <p className="text-sm text-white">
                <Trans>
                  Adjust sliders to see how department spending reductions
                  affect the overall Fall 2025 Budget. The Minister of Finance
                  has asked departments to reduce spending by 7.5% in 2026-27,
                  10% in 2027-28, and 15% in 2028-29.
                </Trans>
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
              {Object.entries(spendingReductions)
                .filter(([category]) => category !== "Other Federal Programs")
                .map(([category, reduction]) => (
                  <div key={category} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium text-white">
                        {category}
                      </label>
                      <span className="text-sm font-semibold text-white">
                        {reduction}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="15"
                      step="0.5"
                      value={reduction}
                      onChange={(e) =>
                        updateSpendingReduction(
                          category,
                          parseFloat(e.target.value),
                        )
                      }
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                      style={{
                        background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${(reduction / 15) * 100}%, #E5E7EB ${(reduction / 20) * 100}%, #E5E7EB 100%)`,
                      }}
                    />
                    <div className="flex justify-between text-xs text-white">
                      <span>0%</span>
                      <span>15%</span>
                    </div>
                  </div>
                ))}
            </div>
          </Section>
        </PageContent>
      )}
    </div>
  );
}
