import { useState } from 'react'
import { cn } from '../lib/utils'
import { Bot, User, Copy, Check, AlertCircle, Table2, Code } from 'lucide-react'

export default function ChatMessage({ message, index }) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser ? "bg-foreground" : "bg-accent"
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-background" />
        ) : (
          <Bot className="w-4 h-4 text-foreground" />
        )}
      </div>

      {/* Content */}
      <div className={cn("flex flex-col gap-3 max-w-[85%]", isUser && "items-end")}>
        {/* Error */}
        {message.error && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-2xl bg-destructive/10 text-destructive">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p className="text-sm">{message.error}</p>
          </div>
        )}

        {/* Text Content */}
        {message.content && (
          <div
            className={cn(
              "px-4 py-3 rounded-2xl text-sm leading-relaxed",
              isUser
                ? "bg-foreground text-background"
                : "bg-accent text-foreground"
            )}
          >
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        )}

        {/* SQL Block */}
        {message.sql && (
          <div className="w-full rounded-xl border border-border overflow-hidden bg-card">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Code className="w-3.5 h-3.5" />
                SQL
              </div>
              <button
                onClick={() => handleCopy(message.sql)}
                className="p-1 rounded hover:bg-accent transition-colors"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </button>
            </div>
            <pre className="p-4 overflow-x-auto text-sm">
              <code className="text-foreground font-mono">{message.sql}</code>
            </pre>
          </div>
        )}

        {/* Results Table */}
        {message.dataframe?.length > 0 && (
          <div className="w-full rounded-xl border border-border overflow-hidden bg-card">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/50">
              <Table2 className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                {message.dataframe.length} {message.dataframe.length === 1 ? 'row' : 'rows'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {Object.keys(message.dataframe[0]).map((key) => (
                      <th
                        key={key}
                        className="px-4 py-2 text-left text-xs font-medium text-muted-foreground"
                      >
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {message.dataframe.slice(0, 10).map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                    >
                      {Object.values(row).map((value, j) => (
                        <td key={j} className="px-4 py-2 text-foreground">
                          {value !== null ? (
                            String(value)
                          ) : (
                            <span className="text-muted-foreground italic">null</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {message.dataframe.length > 10 && (
                <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
                  Showing 10 of {message.dataframe.length} rows
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
