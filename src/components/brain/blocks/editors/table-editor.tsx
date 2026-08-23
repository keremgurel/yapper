"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BrainTable } from "@/lib/db/schema";

/**
 * An imported grid.
 *
 * A page of rows at a time, not all of them. A creator who imported five
 * thousand keywords is not going to scroll them, and rendering five thousand
 * editable inputs would make the page unusable for the one thing they actually
 * do here, which is check that the import landed and fix a column name.
 *
 * Everything stays: only the rendering is paged. The prompt never reads by
 * position anyway, it reads by relevance.
 */
const PAGE = 25;

export default function TableEditor({
  table,
  onChange,
}: {
  table: BrainTable;
  onChange: (table: BrainTable) => void;
}) {
  const [shown, setShown] = useState(PAGE);
  const visible = table.rows.slice(0, shown);
  const remaining = table.rows.length - visible.length;

  const setColumn = (index: number, value: string) =>
    onChange({
      ...table,
      columns: table.columns.map((column, at) =>
        at === index ? value : column,
      ),
    });

  const setCell = (row: number, column: number, value: string) =>
    onChange({
      ...table,
      rows: table.rows.map((cells, at) =>
        at === row
          ? cells.map((cell, cellAt) => (cellAt === column ? value : cell))
          : cells,
      ),
    });

  const removeRow = (row: number) =>
    onChange({ ...table, rows: table.rows.filter((_, at) => at !== row) });

  return (
    <div className="space-y-2">
      <div className="border-border overflow-x-auto rounded-xl border">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-muted">
              {table.columns.map((column, index) => (
                <th key={index} className="p-0 text-left">
                  <input
                    value={column}
                    aria-label={`Column ${index + 1} name`}
                    onChange={(event) => setColumn(index, event.target.value)}
                    className="text-muted-foreground w-full min-w-28 bg-transparent px-4 py-2 text-xs font-semibold outline-none"
                  />
                </th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-border/60 divide-y">
            {visible.map((cells, row) => (
              <tr key={row} className="group hover:bg-muted/50">
                {cells.map((cell, column) => (
                  <td key={column} className="p-0">
                    <input
                      value={cell}
                      aria-label={`Row ${row + 1}, ${table.columns[column]}`}
                      onChange={(event) =>
                        setCell(row, column, event.target.value)
                      }
                      className="min-h-10 w-full min-w-28 bg-transparent px-4 py-2 outline-none"
                    />
                  </td>
                ))}
                <td className="px-1">
                  <button
                    type="button"
                    aria-label={`Remove row ${row + 1}`}
                    onClick={() => removeRow(row)}
                    className="text-muted-foreground hover:text-foreground opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-muted-foreground font-mono text-xs tabular-nums">
          {table.rows.length} rows
        </span>
        {remaining > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShown((current) => current + PAGE * 4)}
          >
            Show {Math.min(remaining, PAGE * 4)} more
          </Button>
        )}
      </div>
    </div>
  );
}
