import { Database } from 'lucide-react'
import ConnectionPanel from './ConnectionPanel'
import SchemaExplorer from './SchemaExplorer'

export default function Sidebar({ session, setSession, setSchema, schema }) {
  return (
    <aside className="w-72 border-r border-border bg-card flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-foreground flex items-center justify-center">
            <Database className="w-4.5 h-4.5 text-background" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground">Database Analyzer</h1>
            <p className="text-xs text-muted-foreground">Powered by AI</p>
          </div>
        </div>
      </div>

      {/* Connection */}
      <ConnectionPanel
        session={session}
        setSession={setSession}
        setSchema={setSchema}
      />

      {/* Schema */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <SchemaExplorer schema={schema} />
      </div>
    </aside>
  )
}
