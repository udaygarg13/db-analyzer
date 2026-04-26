import { useState } from 'react'
import { cn } from '../lib/utils'
import { Table2, ChevronRight, Key, Link2 } from 'lucide-react'

export default function SchemaExplorer({ schema }) {
  const [expandedTable, setExpandedTable] = useState(null)

  if (!schema?.tables?.length) {
    return null
  }

  return (
    <div className="p-4 border-t border-border">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
        Schema
      </h3>
      <div className="space-y-1">
        {schema.tables.map((table) => (
          <div key={table.name} className="rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedTable(expandedTable === table.name ? null : table.name)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-left transition-colors",
                expandedTable === table.name
                  ? "bg-accent"
                  : "hover:bg-accent/50"
              )}
            >
              <ChevronRight
                className={cn(
                  "w-3.5 h-3.5 text-muted-foreground transition-transform",
                  expandedTable === table.name && "rotate-90"
                )}
              />
              <Table2 className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground flex-1 truncate">
                {table.name}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {table.row_count.toLocaleString()}
              </span>
            </button>
            
            {expandedTable === table.name && (
              <div className="px-3 pb-2 space-y-0.5">
                {table.columns.map((col) => (
                  <div
                    key={col.name}
                    className="flex items-center gap-2 py-1.5 pl-7 text-sm"
                  >
                    <span className="text-foreground truncate flex-1">{col.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">{col.type}</span>
                    {col.primary_key && (
                      <Key className="w-3 h-3 text-amber-500" />
                    )}
                    {col.foreign_key && (
                      <Link2 className="w-3 h-3 text-blue-500" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
