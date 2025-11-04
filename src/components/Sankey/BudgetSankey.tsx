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
          name: t`Social Security`,
          children: [
            {
              name: t`Retirement Benefits`,
              amount2024: 76.03,
              amount2025: 83.1,
              kind: "transfer" as SpendingKind,
            },
            {
              name: t`Employment Insurance`,
              amount2024: 23.13,
              amount2025: 30.5,
              kind: "transfer" as SpendingKind,
            },
            {
              name: t`Children's Benefits`,
              amount2024: 26.34,
              amount2025: 30.1,
              kind: "transfer" as SpendingKind,
            },
            {
              name: t`COVID-19 Income Support`,
              amount2024: -4.84,
              amount2025: 0,
              kind: "transfer" as SpendingKind,
            },
          ],
        },
        {
          name: t`Transfers to Provinces`,
          link: "https://www.canada.ca/en/department-finance/programs/federal-transfers/major-federal-transfers.html",
          children: [
            {
              name: t`Health Transfer to Provinces`,
              amount2024: 49.42,
              amount2025: 54.7,
            },
            {
              name: t`Social Transfer to Provinces`,
              amount2024: 16.42,
              amount2025: 17.4,
            },
            {
              name: t`Equalization Payments to Provinces`,
              amount2024: 23.963,
              amount2025: 26.2,
            },
            {
              name: t`Territorial Formula Financing`,
              amount2024: 4.8,
              amount2025: 5.5,
            },
            {
              name: t`Health agreements with provinces and territories`,
              amount2024: 4.3,
              amount2025: 4.3,
            },
            {
              name: t`Canada-wide early learning and child care`,
              amount2024: 5.6,
              amount2025: 7.9,
            },
            {
              name: t`Canada Community-Building Fund`,
              amount2024: 2.4,
              amount2025: 2.5,
            },
            {
              name: t`Other fiscal arrangements`,
              amount2024: -6.7,
              amount2025: -7.6,
            },
          ],
        },
        {
          name: t`Pollution pricing`,
          amount2024: 9.9,
          amount2025: 5.0,
        },
        {
          name: t`Public Debt Charges`,
          amount2024: 47.27,
          amount2025: 55.6,
          kind: "debt" as SpendingKind,
        },
        {
          name: t`Direct program expenses`,
          children: [
            {
              name: t`Other transfer payments`,
              amount2024: 107.1,
              amount2025: 115.6,
            },
            {
              name: t`Other direct program expenses`,
              amount2024: 130.5,
              amount2025: 150.2,
            },
          ],
        },
        {
          name: t`Net actuarial losses (gains)`,
          amount2024: 4.0,
          amount2025: 5.0,
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
              amount2025: 54.4,
            },
            {
              name: t`Customs Import Duties`,
              amount2024: 5.57,
              amount2025: 9.9,
            },
            {
              name: t`Other Excise Taxes and Duties`,
              amount2024: 6.83,
              amount2025: 13.2,
            },
          ],
        },
        {
          name: t`Income Tax Revenues`,
          children: [
            {
              name: t`Individual Income Tax`,
              amount2024: 217.7,
              amount2025: 237.9,
            },
            {
              name: t`Corporate Income Tax`,
              amount2024: 82.47,
              amount2025: 97.1,
            },
            {
              name: t`Non-Resident Income Tax`,
              amount2024: 12.54,
              amount2025: 13.7,
            },
          ],
        },
        {
          name: t`Employment Insurance Premiums`,
          amount2024: 29.56,
          amount2025: 32.2,
        },
        {
          name: t`Pollution pricing proceeds`,
          amount2024: 9.86,
          amount2025: 0,
        },
        {
          name: t`Other Non-Tax Revenue`,
          children: [
            {
              name: t`Crown Corporations and other government business enterprises`,
              amount2024: 3.22,
              amount2025: 11.3,
            },
            {
              name: t`Net Foreign Exchange Revenue and Return on Investments`,
              amount2024: 4.28,
              amount2025: 6.0,
            },
            {
              name: t`Other Programs`,
              amount2024: 15.87,
              amount2025: 31.8,
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
