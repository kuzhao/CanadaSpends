"use client";
import { SankeyChart } from "./SankeyChart";
import { SankeyData } from "./SankeyChartD3";

export function JurisdictionSankey({
  data,
  jurisdictionSlug,
}: {
  data: SankeyData;
  jurisdictionSlug?: string;
}) {
  return <SankeyChart data={data} jurisdictionSlug={jurisdictionSlug} />;
}
