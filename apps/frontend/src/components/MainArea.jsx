import { useState, useRef, useEffect } from 'react'
import { cn } from '../lib/utils'
import { Database, Sparkles, Bot, ArrowUp } from 'lucide-react'
import ChatMessage from './ChatMessage'

const SUGGESTIONS = [
  "Show me all tables and their row counts",
  "What are the most common values?",
  "Find patterns in the data",
  "Summarize the structure"
]

export default function MainArea({ session, schema }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    setMessages([])
  }, [session])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px'
    }
  }, [input])

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (!input.trim() || !session || loading) return

    const question = input
    setInput('')
    setLoading(true)

    setMessages(prev => [...prev, { role: 'user', content: question }])

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session,
          question,
          stream: false,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Query failed')
      }

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer,
          sql: data.sql,
          dataframe: data.dataframe,
          error: data.error,
        },
      ])
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '', error: err.message },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Empty state - not connected
  if (!schema) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-8 bg-background">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-6">
          <Database className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2 text-balance text-center">
          Connect a Database
        </h2>
        <p className="text-muted-foreground text-center text-sm">
          Connect a database using a file or connection URL in the sidebar to begin.
        </p>
      </main>
    )
  }

  const totalRows = schema.tables?.reduce((sum, t) => sum + t.row_count, 0) || 0
  const totalCols = schema.tables?.reduce((sum, t) => sum + t.columns.length, 0) || 0

  return (
    <main className="flex-1 flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-sm font-semibold text-foreground">Database</h1>
            <p className="text-xs text-muted-foreground">Statistics</p>
          </div>
        </div>
        <div className="w-px h-6 bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-2xl font-semibold text-foreground">{schema.tables?.length || 0}</span>
          <span className="text-sm text-muted-foreground">tables</span>
        </div>
        <div className="w-px h-6 bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-2xl font-semibold text-foreground">{totalCols}</span>
          <span className="text-sm text-muted-foreground">columns</span>
        </div>
        <div className="w-px h-6 bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-2xl font-semibold text-foreground">{totalRows.toLocaleString()}</span>
          <span className="text-sm text-muted-foreground">rows</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-full">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-6">
              <Sparkles className="w-7 h-7 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2 text-balance text-center">
              Ask about your data
            </h2>
            <p className="text-muted-foreground text-center text-sm mb-8">
              I can query your database, analyze patterns, and find insights.
            </p>
            <div className="grid grid-cols-2 gap-2 max-w-md w-full">
              {SUGGESTIONS.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => setInput(suggestion)}
                  className="px-4 py-3 text-left rounded-xl border border-border bg-card hover:bg-accent hover:border-foreground/20 transition-all text-sm text-foreground"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((message, index) => (
              <ChatMessage key={index} message={message} index={index} />
            ))}

            {/* Loading indicator */}
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                  <Bot className="w-4 h-4 text-foreground" />
                </div>
                <div className="px-4 py-3 rounded-2xl bg-accent">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border px-4 pt-3 pb-4 bg-card">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2">
            <div className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about your data"
                disabled={loading}
                rows={1}
                className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 leading-6 block"
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || loading}
              className={cn(
                "flex-shrink-0 w-[46px] h-[46px] rounded-xl flex items-center justify-center transition-all",
                !input.trim() || loading
                  ? "bg-muted text-muted-foreground cursor-not-allowed opacity-40"
                  : "bg-foreground text-background hover:opacity-85 active:scale-95"
              )}
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}