"use client";

import { ImpactMatrixData, ImpactMatrixCell } from "@/lib/types";

function formatSystemName(name: string): string {
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function truncateText(text: string, maxLen: number = 60): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}

function CellContent({ cell }: { cell: ImpactMatrixCell | undefined }) {
  if (!cell) {
    return <div className="w-full h-full bg-muted/30" />;
  }

  const isEngineerCorrected = cell.suggested_by === "engineer";
  const bgClass = isEngineerCorrected
    ? "bg-status-warning-muted border-status-warning/30"
    : "bg-status-teal-muted border-status-teal/30";

  const confidence = cell.confidence_score
    ? `${Math.round(cell.confidence_score * 100)}%`
    : null;

  return (
    <div
      className={`w-full h-full flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 ${bgClass} border rounded`}
      title={`System: ${formatSystemName(cell.system_name)}\nObligation: ${cell.obligation_text}\nConfidence: ${confidence ?? "N/A"}\nSource: ${cell.suggested_by}${cell.engineer_note ? `\nNote: ${cell.engineer_note}` : ""}`}
    >
      <span className={`text-sm font-medium ${isEngineerCorrected ? "text-status-warning-foreground" : "text-status-teal-foreground"}`}>
        {isEngineerCorrected ? "\u2713\u270E" : "\u2713"}
      </span>
      {confidence && (
        <span className="text-[10px] text-muted-foreground">{confidence}</span>
      )}
      {cell.engineer_note && (
        <span className="text-[10px] text-status-warning-foreground" title={cell.engineer_note}>
          *
        </span>
      )}
    </div>
  );
}

export default function ImpactMatrix({ data }: { data: ImpactMatrixData }) {
  if (!data.systems.length || !data.obligations.length) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-muted-foreground">
          No confirmed mappings yet. Complete the engineering review first.
        </p>
      </div>
    );
  }

  // Build a lookup map: "system_name:obligation_id" -> cell
  const cellMap = new Map<string, ImpactMatrixCell>();
  for (const cell of data.cells) {
    cellMap.set(`${cell.system_name}:${cell.obligation_id}`, cell);
  }

  // Count affected obligations per system (for summary row)
  const systemCounts = new Map<string, number>();
  for (const system of data.systems) {
    let count = 0;
    for (const ob of data.obligations) {
      if (cellMap.has(`${system}:${ob.id}`)) count++;
    }
    systemCounts.set(system, count);
  }

  return (
    <div className="overflow-auto rounded-lg border bg-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-20 bg-card border-b border-r px-4 py-3 text-left font-semibold text-foreground min-w-[240px]">
              Obligation
            </th>
            {data.systems.map((system) => (
              <th
                key={system}
                className="sticky top-0 z-10 bg-card border-b px-3 py-3 text-center font-semibold text-foreground min-w-[100px] whitespace-nowrap"
              >
                {formatSystemName(system)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.obligations.map((ob, idx) => (
            <tr
              key={ob.id}
              className={`hover:bg-accent/30 transition-colors ${
                idx % 2 === 0 ? "bg-background" : "bg-muted/20"
              }`}
            >
              <td
                className="sticky left-0 z-10 border-r px-4 py-2.5 text-foreground font-medium bg-inherit"
                title={ob.text}
              >
                {truncateText(ob.text)}
              </td>
              {data.systems.map((system) => (
                <td
                  key={`${system}:${ob.id}`}
                  className="px-1 py-1 text-center border-l"
                >
                  <CellContent cell={cellMap.get(`${system}:${ob.id}`)} />
                </td>
              ))}
            </tr>
          ))}

          {/* Summary row */}
          <tr className="border-t-2 border-primary/20 bg-muted/40 font-semibold">
            <td className="sticky left-0 z-10 border-r px-4 py-2.5 text-foreground bg-inherit">
              Total Obligations
            </td>
            {data.systems.map((system) => (
              <td
                key={`count-${system}`}
                className="px-3 py-2.5 text-center text-primary border-l"
              >
                {systemCounts.get(system) ?? 0}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
