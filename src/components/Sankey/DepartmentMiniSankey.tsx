"use client";
import { Department } from "@/lib/jurisdictions";
import { SankeyChart } from "./SankeyChart";
import { SankeyData } from "./SankeyChartD3";

function formatDepartmentAsSankey(department: Department): SankeyData {
  return {
    total: department.totalSpending,
    spending: department.totalSpending,
    revenue: 0,
    spending_data: {
      id: `${department.slug}-spending-root`,
      displayName: department.name,
      name: department.name,
      amount: department.totalSpending,
      children: department.spending_data.children.map((c, i) => ({
        id: `${department.slug}-spending-${i}`,
        displayName: c.name,
        name: c.name,
        amount: c.amount,
        children: [],
      })),
    },
    revenue_data: {
      id: `${department.slug}-revenue-root`,
      displayName: `Revenue`,
      name: `Revenue`,
      amount: 0,
      children: [],
    },
  };
}

export function DepartmentMiniSankey({
  department,
}: {
  department: Department;
}) {
  const data = formatDepartmentAsSankey(department);

  return (
    <div className="sankey-chart-container spending-only">
      <SankeyChart data={data} />
    </div>
  );
}
