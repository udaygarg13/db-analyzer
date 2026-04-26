import { useState } from 'react'
import { cn } from '../lib/utils'
import { Database, Upload, Loader2, ChevronRight, Server, Unplug } from 'lucide-react'

const DB_TYPES = [
  { value: 'sqlite', label: 'SQLite', placeholder: 'sqlite:///path/to/db.db' },
  { value: 'postgresql', label: 'PostgreSQL', placeholder: 'postgresql://user:pass@host:port/db' },
  { value: 'mysql', label: 'MySQL', placeholder: 'mysql+pymysql://user:pass@host:port/db' },
  { value: 'custom', label: 'Custom', placeholder: 'dialect+driver://user:pass@host/db' },
]

export default function ConnectionPanel({ session, setSession, setSchema }) {
  const [dbType, setDbType] = useState('sqlite')
  const [dbUrl, setDbUrl] = useState('')
  const [model, setModel] = useState('llama3')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [dragActive, setDragActive] = useState(false)

  const currentDbType = DB_TYPES.find(d => d.value === dbType)

  const handleConnect = async () => {
    setLoading(true)
    setError('')
    
    const sessionId = Date.now().toString()
    
    try {
      let finalDbUrl = dbUrl
      
      if (dbType === 'sqlite' && selectedFile) {
        const formData = new FormData()
        formData.append('file', selectedFile)
        formData.append('session_id', sessionId)
        formData.append('db_type', dbType)
        formData.append('model', model)
        
        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })
        
        const uploadData = await uploadResponse.json()
        
        if (!uploadResponse.ok) {
          throw new Error(uploadData.detail || 'Upload failed')
        }
        
        finalDbUrl = uploadData.db_url
      }
      
      const response = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          db_url: finalDbUrl,
          db_type: dbType,
          model,
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.detail || 'Connection failed')
      }
      
      setSession(sessionId)
      setSchema(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnect = async () => {
    if (session) {
      await fetch(`/api/session/${session}`, { method: 'DELETE' })
      setSession(null)
      setSchema(null)
    }
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0])
    }
  }

  if (session) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Connected</span>
          <button
            onClick={handleDisconnect}
            className="ml-auto p-1.5 rounded-md hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 transition-colors"
          >
            <Unplug className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Database Type */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Database
        </label>
        <div className="grid grid-cols-2 gap-2">
          {DB_TYPES.map((type) => (
            <button
              key={type.value}
              onClick={() => setDbType(type.value)}
              className={cn(
                "flex items-center gap-1 px-3 py-2 rounded-lg border text-sm font-medium transition-all",
                dbType === type.value
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card hover:bg-accent text-foreground"
              )}
            >
              <Server className="w-3.5 h-3.5" />
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* SQLite File Upload */}
      {dbType === 'sqlite' && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Database File
          </label>
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={cn(
              "relative flex flex-col items-center justify-center p-6 rounded-lg border-2 border-dashed transition-all cursor-pointer",
              dragActive
                ? "border-foreground bg-accent"
                : selectedFile
                ? "border-emerald-500/50 bg-emerald-500/5"
                : "border-border hover:border-muted-foreground hover:bg-accent/50"
            )}
          >
            <input
              type="file"
              accept=".db,.sqlite,.sqlite3"
              onChange={(e) => setSelectedFile(e.target.files[0])}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            {selectedFile ? (
              <>
                <Database className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mb-2" />
                <span className="text-sm font-medium text-foreground">{selectedFile.name}</span>
                <span className="text-xs text-muted-foreground mt-1">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </span>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">Drop .db file here</span>
                <span className="text-xs text-muted-foreground mt-1">or click to browse</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Database URL */}
      {(dbType !== 'sqlite' || !selectedFile) && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {dbType === 'sqlite' ? 'Or enter URL' : 'Connection URL'}
          </label>
          <input
            type="text"
            value={dbUrl}
            onChange={(e) => setDbUrl(e.target.value)}
            placeholder={currentDbType?.placeholder}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
          />
        </div>
      )}

      {/* Model */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Ollama Model
        </label>
        <input
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="llama3"
          className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
        />
        <p className="text-xs text-muted-foreground">
          Please ensure that ollama is running
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Connect Button */}
      <button
        onClick={handleConnect}
        disabled={loading || (!dbUrl && !selectedFile)}
        className={cn(
          "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-sm transition-all",
          loading || (!dbUrl && !selectedFile)
            ? "bg-muted text-muted-foreground cursor-not-allowed"
            : "bg-foreground text-background hover:bg-foreground/90"
        )}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            Connect
            <ChevronRight className="w-4 h-4" />
          </>
        )}
      </button>
    </div>
  )
}
