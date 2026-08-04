/**
 * LogConsoleViewer — terminal-style log panel for pipeline run history & live streaming.
 *
 * Aesthetics:
 *  - Deep-obsidian (#0A0A0A) background
 *  - JetBrains Mono / Fira Code / Cascadia Code monospace at 12px
 *  - ANSI-inspired colour coding per log level
 *  - Auto-scroll to bottom, sticky when streaming
 *  - Copy & Download utilities
 */
import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  X,
  Copy,
  Download,
  CheckCheck,
  Loader2,
  Terminal,
  Wifi,
  WifiOff,
  AlertTriangle,
  Info,
  Zap,
  CircleCheck
} from 'lucide-react'
import apiClient from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { APP_CONFIG } from '@/config/constants'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LogEntry {
  id: string
  run_id: string
  level: string
  message: string
  timestamp: string
  sequence: number
  extra?: Record<string, unknown> | null
}

export interface LogConsoleViewerProps {
  isOpen: boolean
  onClose: () => void
  pipelineId: string
  pipelineName: string
  runId: string | null           // Celery task_id / run_id
  pipelineStatus: 'active' | 'syncing' | 'idle' | 'failed'
}

// ─── Log-level colour coding ──────────────────────────────────────────────────

function getLevelStyle(level: string, message: string): { color: string; bg: string } {
  const up = level.toUpperCase()
  if (up === 'ERROR' || message.includes('[ERROR]') || message.includes('[TRACEBACK]')) {
    return { color: '#f87171', bg: 'rgba(239,68,68,0.07)' }
  }
  if (up === 'WARNING' || message.includes('[WARN]')) {
    return { color: '#fb923c', bg: 'rgba(251,146,60,0.07)' }
  }
  if (message.includes('[SUCCESS]')) {
    return { color: '#34d399', bg: 'rgba(52,211,153,0.07)' }
  }
  if (message.includes('[CONFIG]')) {
    return { color: '#7dd3fc', bg: 'transparent' }
  }
  if (message.includes('[ETL]') || message.includes('[INIT]')) {
    return { color: '#a78bfa', bg: 'transparent' }
  }
  // INFO default
  return { color: '#94a3b8', bg: 'transparent' }
}

function getLevelBadge(level: string, message: string) {
  if (level === 'ERROR' || message.includes('[ERROR]') || message.includes('[TRACEBACK]')) {
    return <span style={{ color: '#f87171', marginRight: 6, fontSize: 10 }}>ERR</span>
  }
  if (level === 'WARNING') {
    return <span style={{ color: '#fb923c', marginRight: 6, fontSize: 10 }}>WRN</span>
  }
  if (message.includes('[SUCCESS]')) {
    return <span style={{ color: '#34d399', marginRight: 6, fontSize: 10 }}>SUC</span>
  }
  return <span style={{ color: '#64748b', marginRight: 6, fontSize: 10 }}>INF</span>
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toISOString().replace('T', ' ').substring(0, 23)
  } catch {
    return iso.substring(0, 23)
  }
}

// ─── Individual log line ───────────────────────────────────────────────────────

const LogLine: React.FC<{ entry: LogEntry; index: number }> = ({ entry, index }) => {
  const { color, bg } = getLevelStyle(entry.level, entry.message)
  const isMultiline = entry.message.includes('\n')

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        padding: '2px 12px',
        backgroundColor: bg,
        borderLeft: bg !== 'transparent' ? `2px solid ${color}22` : '2px solid transparent',
        minHeight: 22,
        gap: 0
      }}
    >
      {/* Sequence number */}
      <span style={{
        color: '#374151',
        fontSize: 10,
        fontFamily: 'inherit',
        minWidth: 32,
        userSelect: 'none',
        paddingTop: 1
      }}>
        {String(index + 1).padStart(4, ' ')}
      </span>

      {/* Timestamp */}
      <span style={{
        color: '#4b5563',
        fontSize: 11,
        fontFamily: 'inherit',
        minWidth: 180,
        paddingRight: 10,
        paddingTop: 1,
        whiteSpace: 'nowrap',
        userSelect: 'none'
      }}>
        {formatTimestamp(entry.timestamp)}
      </span>

      {/* Level badge */}
      <span style={{ paddingTop: 1 }}>
        {getLevelBadge(entry.level, entry.message)}
      </span>

      {/* Message */}
      <span style={{
        color,
        fontSize: 12,
        fontFamily: 'inherit',
        flex: 1,
        whiteSpace: isMultiline ? 'pre-wrap' : 'pre',
        wordBreak: 'break-all',
        lineHeight: '1.6'
      }}>
        {entry.message}
      </span>
    </div>
  )
}

// ─── Status bar ───────────────────────────────────────────────────────────────

const StatusBar: React.FC<{
  isStreaming: boolean
  isDone: boolean
  isConnected: boolean
  logCount: number
  pipelineStatus: string
}> = ({ isStreaming, isDone, isConnected, logCount, pipelineStatus }) => {
  const isFailed = pipelineStatus === 'failed'

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '6px 14px',
      background: '#0d0d0f',
      borderTop: '1px solid #1c1c1e',
      fontSize: 10,
      fontFamily: 'inherit',
      color: '#4b5563'
    }}>
      {/* Connection indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {isStreaming && !isDone ? (
          <>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#34d399',
              boxShadow: '0 0 6px #34d399',
              display: 'inline-block',
              animation: 'pulse 1.5s infinite'
            }} />
            <span style={{ color: '#34d399' }}>LIVE STREAM</span>
          </>
        ) : isDone && !isFailed ? (
          <>
            <CircleCheck size={10} style={{ color: '#34d399' }} />
            <span style={{ color: '#34d399' }}>COMPLETED</span>
          </>
        ) : isFailed ? (
          <>
            <AlertTriangle size={10} style={{ color: '#f87171' }} />
            <span style={{ color: '#f87171' }}>FAILED</span>
          </>
        ) : (
          <>
            <Info size={10} />
            <span>HISTORICAL</span>
          </>
        )}
      </div>

      <span style={{ color: '#1f2937' }}>|</span>

      {/* Log count */}
      <span>{logCount} line{logCount !== 1 ? 's' : ''}</span>

      <span style={{ color: '#1f2937' }}>|</span>

      {/* Connection state */}
      {isStreaming && !isDone && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {isConnected ? (
            <Wifi size={9} style={{ color: '#4b5563' }} />
          ) : (
            <WifiOff size={9} style={{ color: '#f87171' }} />
          )}
          <span>{isConnected ? 'SSE connected' : 'reconnecting...'}</span>
        </div>
      )}

      <span style={{ marginLeft: 'auto' }}>{APP_CONFIG.APP_NAME} run console {APP_CONFIG.CONSOLE_VERSION}</span>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export const LogConsoleViewer: React.FC<LogConsoleViewerProps> = ({
  isOpen,
  onClose,
  pipelineId,
  pipelineName,
  runId,
  pipelineStatus
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)

  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const { token } = useAuthStore()

  // ── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  // ── Detect manual scroll-up → pause auto-scroll ──────────────────────────
  const handleScroll = useCallback(() => {
    const el = scrollAreaRef.current
    if (!el) return
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    setAutoScroll(isAtBottom)
  }, [])

  // ── Load historical or connect to SSE ────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !runId) return

    setLogs([])
    setIsLoading(true)
    setError(null)
    setIsDone(false)
    setIsStreaming(false)

    const isLive = pipelineStatus === 'syncing'

    if (isLive) {
      // ── Live streaming via SSE ──────────────────────────────────────────
      // First, load any existing logs (task may have started before we opened)
      apiClient.get<{ logs: LogEntry[] }>(`/api/v1/pipelines/runs/${runId}/logs`)
        .then(res => {
          const existing = res.data.logs ?? []
          setLogs(existing)
          setIsLoading(false)

          const lastSeq = existing.length > 0 ? existing[existing.length - 1].sequence : 0
          startSSE(lastSeq)
        })
        .catch(() => {
          setIsLoading(false)
          startSSE(0)
        })
    } else {
      // ── Historical fetch ────────────────────────────────────────────────
      apiClient.get<{ logs: LogEntry[] }>(`/api/v1/pipelines/runs/${runId}/logs`)
        .then(res => {
          setLogs(res.data.logs ?? [])
          setIsLoading(false)
          setIsDone(true)
        })
        .catch(() => {
          setError('Failed to load run logs. The run may not have any logs yet.')
          setIsLoading(false)
        })
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [isOpen, runId, pipelineStatus])

  function startSSE(afterSequence: number) {
    setIsStreaming(true)
    setIsConnected(false)

    // EventSource doesn't support custom headers, so we embed token in query
    const baseUrl = window.location.origin
    const url = `${baseUrl}/api/v1/pipelines/runs/${runId}/logs/stream?after=${afterSequence}`

    // Use fetch-based SSE for auth header support
    const controller = new AbortController()

    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'text/event-stream',
      },
      signal: controller.signal,
    }).then(async response => {
      if (!response.ok || !response.body) {
        setError('Failed to connect to log stream.')
        setIsStreaming(false)
        return
      }
      setIsConnected(true)

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''
        for (const part of parts) {
          const dataLine = part.split('\n').find(l => l.startsWith('data:'))
          if (!dataLine) continue
          const jsonStr = dataLine.slice(5).trim()
          try {
            const parsed = JSON.parse(jsonStr)
            if (parsed.__done__) {
              setIsDone(true)
              setIsStreaming(false)
              setIsConnected(false)
              return
            }
            if (parsed.__heartbeat__) continue
            setLogs(prev => {
              // deduplicate by id
              if (prev.some(l => l.id === parsed.id)) return prev
              return [...prev, parsed as LogEntry]
            })
          } catch {
            // skip malformed JSON
          }
        }
      }
      setIsDone(true)
      setIsStreaming(false)
      setIsConnected(false)
    }).catch(err => {
      if (err.name === 'AbortError') return
      setError('Stream connection error.')
      setIsStreaming(false)
    })

    // Store abort controller for cleanup
    ;(eventSourceRef as any).current = { close: () => controller.abort() }
  }

  // ── Close & cleanup ──────────────────────────────────────────────────────
  const handleClose = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    onClose()
  }

  // ── Utilities ────────────────────────────────────────────────────────────
  const logsText = logs.map(l =>
    `${formatTimestamp(l.timestamp)}  [${l.level}]  ${l.message}`
  ).join('\n')

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(logsText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { }
  }

  const handleDownload = () => {
    const blob = new Blob([logsText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${pipelineName.replace(/\s+/g, '_')}_${runId?.slice(0, 8) ?? 'run'}.log`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!isOpen) return null

  const isFailed = pipelineStatus === 'failed'

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(2px)',
          zIndex: 50
        }}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pipeline Run Log Console"
        style={{
          position: 'fixed',
          inset: '0 0 0 auto',
          width: '100%',
          maxWidth: 740,
          background: '#0A0A0A',
          borderLeft: '1px solid #1c1c1e',
          zIndex: 60,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", "Consolas", "Courier New", monospace',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.8)',
          overflowY: 'hidden'
        }}
      >
        {/* ── Header ── */}
        <div style={{
          padding: '14px 16px',
          borderBottom: '1px solid #1c1c1e',
          background: '#0d0d0f',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0
        }}>
          {/* Traffic-light dots */}
          <div style={{ display: 'flex', gap: 5, marginRight: 4 }}>
            <button onClick={handleClose} style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57', border: 'none', cursor: 'pointer', padding: 0 }} aria-label="Close" />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#1c1c1e' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#1c1c1e' }} />
          </div>

          <Terminal size={13} style={{ color: '#4b5563', flexShrink: 0 }} />

          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {pipelineName}
            </div>
            <div style={{ color: '#374151', fontSize: 10, fontFamily: 'inherit' }}>
              run/{runId ?? '—'}
            </div>
          </div>

          {/* Status chip */}
          <div style={{
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 700,
            background: isFailed ? 'rgba(239,68,68,0.15)' : pipelineStatus === 'syncing' ? 'rgba(14,165,233,0.15)' : 'rgba(52,211,153,0.12)',
            color: isFailed ? '#f87171' : pipelineStatus === 'syncing' ? '#38bdf8' : '#34d399',
            border: `1px solid ${isFailed ? '#f8717133' : pipelineStatus === 'syncing' ? '#38bdf833' : '#34d39933'}`,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            display: 'flex',
            alignItems: 'center',
            gap: 5
          }}>
            {pipelineStatus === 'syncing' && <Loader2 size={9} style={{ animation: 'spin 1s linear infinite' }} />}
            {isFailed && <AlertTriangle size={9} />}
            {(pipelineStatus === 'active' || pipelineStatus === 'idle') && <Zap size={9} />}
            {pipelineStatus}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={handleCopy}
              disabled={logs.length === 0}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 8px',
                background: 'transparent',
                border: '1px solid #262626',
                borderRadius: 5,
                color: copied ? '#34d399' : '#6b7280',
                fontSize: 10,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
                opacity: logs.length === 0 ? 0.4 : 1
              }}
              title="Copy all logs to clipboard"
            >
              {copied ? <CheckCheck size={11} /> : <Copy size={11} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={handleDownload}
              disabled={logs.length === 0}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 8px',
                background: 'transparent',
                border: '1px solid #262626',
                borderRadius: 5,
                color: '#6b7280',
                fontSize: 10,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
                opacity: logs.length === 0 ? 0.4 : 1
              }}
              title="Download as .log file"
            >
              <Download size={11} />
              .log
            </button>
            <button
              onClick={handleClose}
              style={{
                display: 'flex', alignItems: 'center',
                padding: '4px 6px',
                background: 'transparent',
                border: '1px solid #262626',
                borderRadius: 5,
                color: '#6b7280',
                cursor: 'pointer'
              }}
              aria-label="Close log viewer"
            >
              <X size={11} />
            </button>
          </div>
        </div>

        {/* ── Toolbar row ── */}
        <div style={{
          padding: '5px 14px',
          borderBottom: '1px solid #111113',
          background: '#0d0d0f',
          display: 'flex',
          gap: 16,
          fontSize: 10,
          color: '#374151',
          fontFamily: 'inherit',
          flexShrink: 0
        }}>
          <span style={{ color: '#1f2937' }}>pipeline_id={pipelineId}</span>
          <span style={{ color: '#1f2937' }}>|</span>
          <span style={{ color: '#1f2937' }}>task_id={runId ?? 'N/A'}</span>
          {!autoScroll && logs.length > 0 && (
            <button
              onClick={() => {
                setAutoScroll(true)
                bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
              }}
              style={{
                marginLeft: 'auto',
                background: 'rgba(52,211,153,0.12)',
                border: '1px solid #34d39933',
                color: '#34d399',
                fontSize: 10,
                padding: '1px 8px',
                borderRadius: 3,
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            >
              ↓ Jump to bottom
            </button>
          )}
        </div>

        {/* ── Log body ── */}
        <div
          ref={scrollAreaRef}
          onScroll={handleScroll}
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '8px 0',
            lineHeight: '1.5'
          }}
        >
          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 8, color: '#374151', fontSize: 12 }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: '#4b5563' }} />
              <span>Loading run logs...</span>
            </div>
          ) : error ? (
            <div style={{
              margin: 16,
              padding: 12,
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 6,
              color: '#f87171',
              fontSize: 12
            }}>
              <AlertTriangle size={13} style={{ display: 'inline', marginRight: 6 }} />
              {error}
            </div>
          ) : logs.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 8, color: '#374151', fontSize: 12 }}>
              <Terminal size={24} style={{ color: '#1f2937' }} />
              <span>No log entries yet for this run.</span>
              {pipelineStatus === 'syncing' && (
                <span style={{ fontSize: 10, color: '#1f2937' }}>Waiting for task to emit logs...</span>
              )}
            </div>
          ) : (
            <>
              {/* Column headers */}
              <div style={{
                display: 'flex',
                padding: '0 12px 4px',
                borderBottom: '1px solid #111113',
                marginBottom: 4,
                fontSize: 9,
                color: '#1f2937',
                userSelect: 'none',
                gap: 0
              }}>
                <span style={{ minWidth: 32 }}> #</span>
                <span style={{ minWidth: 180 }}>TIMESTAMP (UTC)</span>
                <span style={{ minWidth: 38 }}>LVL</span>
                <span>MESSAGE</span>
              </div>

              {logs.map((entry, i) => (
                <LogLine key={entry.id} entry={entry} index={i} />
              ))}

              {/* Blinking cursor when streaming */}
              {isStreaming && !isDone && (
                <div style={{ padding: '2px 12px', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <span style={{ color: '#34d399', fontSize: 11 }}>▶</span>
                  <span style={{ color: '#1f2937', fontSize: 11 }}>
                    Streaming...
                  </span>
                  <span style={{
                    display: 'inline-block',
                    width: 7, height: 13,
                    background: '#34d399',
                    animation: 'blink 1s step-end infinite',
                    opacity: 0.8,
                    borderRadius: 1
                  }} />
                </div>
              )}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        {/* ── Status bar ── */}
        <StatusBar
          isStreaming={isStreaming}
          isDone={isDone}
          isConnected={isConnected}
          logCount={logs.length}
          pipelineStatus={pipelineStatus}
        />
      </div>

      {/* Inline keyframes */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes pulse { 0%, 100% { opacity: 1; box-shadow: 0 0 4px #34d399; } 50% { opacity: 0.6; box-shadow: 0 0 10px #34d399; } }
      `}</style>
    </>
  )
}

export default LogConsoleViewer
