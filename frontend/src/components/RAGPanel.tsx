import React, { useState, useEffect, useRef, useCallback } from 'react'
import apiClient from '@/api/client'
import { Upload, FileText, Send, Download, Cpu, Loader2, BookOpen } from 'lucide-react'

interface DocumentItem {
  filename: string
  size: number
  created_at: number
}

interface ChatMessage {
  id: string
  sender: 'user' | 'assistant'
  text: string
  timestamp: string
}

export const RAGPanel: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [queryText, setQueryText] = useState('')
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [querying, setQuerying] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const fetchDocuments = useCallback(async () => {
    try {
      const response = await apiClient.get('/api/v1/documents')
      setDocuments(response.data)
      if (response.data.length > 0) {
        setSelectedDoc((prev) => prev || response.data[0].filename)
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error)
    }
  }, [])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    const formData = new FormData()
    formData.append('file', file)

    setUploading(true)
    try {
      await apiClient.post('/api/v1/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      await fetchDocuments()
      setSelectedDoc(file.name)
    } catch (error) {
      console.error(error)
    } finally {
      setUploading(false)
    }
  }

  const handleQuerySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!queryText.trim()) return

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'user',
      text: queryText,
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false })
    }

    setChatHistory((prev) => [...prev, userMsg])
    setQueryText('')
    setQuerying(true)

    try {
      const response = await apiClient.post(
        '/api/v1/documents/query',
        {
          query: userMsg.text,
          document_ids: selectedDoc ? [selectedDoc] : []
        }
      )

      const assistantMsg: ChatMessage = {
        id: String(Date.now() + 1),
        sender: 'assistant',
        text: response.data.answer,
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false })
      }

      setChatHistory((prev) => [...prev, assistantMsg])
    } catch (error) {
      console.error(error)
      const errorMsg: ChatMessage = {
        id: String(Date.now() + 1),
        sender: 'assistant',
        text: 'Error processing document similarity lookup. Ensure a text/PDF document is uploaded and configured.',
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false })
      }
      setChatHistory((prev) => [...prev, errorMsg])
    } finally {
      setQuerying(false)
    }
  }

  const handleExport = async (format: 'excel' | 'pdf') => {
    const assistantMsg = [...chatHistory].reverse().find((m) => m.sender === 'assistant')
    if (!assistantMsg) return

    try {
      const response = await apiClient.post(
        '/api/v1/documents/export',
        { format, content: assistantMsg.text },
        {
          responseType: 'blob'
        }
      )

      const blob = new Blob([response.data], {
        type:
          format === 'excel'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'application/pdf'
      })

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute(
        'download',
        format === 'excel' ? 'vendor_comparison_matrix.xlsx' : 'vendor_comparison_report.pdf'
      )
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-120px)] max-w-7xl font-sans">
      <div className="w-full md:w-5/12 bg-panel border border-border-primary rounded-xl flex flex-col justify-between p-6 overflow-hidden">
        <div className="space-y-6 flex-1 flex flex-col overflow-hidden">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold tracking-tight text-text-primary uppercase flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-text-muted" />
              Document Library
            </h3>
            <p className="text-xs text-text-muted">Manage unstructured vendor quotation files.</p>
          </div>

          <label className="border border-dashed border-border-primary hover:border-border-secondary bg-panel-card/40 rounded-xl p-6 text-center cursor-pointer block transition-all">
            <input type="file" accept=".pdf,.txt,.png,.jpg,.jpeg" onChange={handleFileUpload} className="hidden" />
            {uploading ? (
              <div className="space-y-2">
                <Loader2 className="h-6 w-6 animate-spin text-text-muted mx-auto" />
                <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">Running OCR Extraction...</span>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-6 w-6 text-text-muted mx-auto" />
                <span className="text-[10px] text-text-primary uppercase tracking-wider font-semibold block">Upload Quote PDF / Image</span>
                <span className="text-[9px] text-text-muted block">PDF, TXT, PNG, JPG</span>
              </div>
            )}
          </label>

          <div className="flex-1 flex flex-col overflow-hidden space-y-3">
            <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block">Uploaded Content</span>
            {documents.length === 0 ? (
              <div className="flex-1 flex items-center justify-center border border-border-primary rounded-lg text-xs text-text-muted p-8 text-center bg-panel-card/20">
                No analyzed documents found. Drag and drop a file to process embeddings.
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto divide-y divide-border-primary border border-border-primary rounded-lg bg-panel-card/10">
                {documents.map((doc) => (
                  <button
                    key={doc.filename}
                    onClick={() => setSelectedDoc(doc.filename)}
                    className={`w-full py-3 px-4 flex items-center justify-between text-left text-xs transition-colors ${
                      selectedDoc === doc.filename
                        ? 'bg-panel-card text-text-primary font-medium'
                        : 'text-text-secondary hover:text-text-primary hover:bg-panel-card/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <FileText className="h-4 w-4 shrink-0 text-text-muted" />
                      <span className="truncate">{doc.filename}</span>
                    </div>
                    <span className="text-[9px] text-text-muted font-mono shrink-0">
                      {(doc.size / 1024).toFixed(1)} KB
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="w-full md:w-7/12 bg-panel border border-border-primary rounded-xl flex flex-col justify-between overflow-hidden">
        <div className="p-6 border-b border-border-primary flex items-center justify-between bg-panel-card/10">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold tracking-tight text-text-primary uppercase flex items-center gap-2">
              <Cpu className="h-4 w-4 text-text-muted" />
              Conversational RAG Agent
            </h3>
            <p className="text-xs text-text-muted">Interactive side-by-side quotation comparison analyzer.</p>
          </div>
          {chatHistory.some((m) => m.sender === 'assistant') && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExport('excel')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border-primary hover:border-border-secondary bg-panel-card text-text-primary text-[10px] font-semibold uppercase tracking-wider rounded transition-all cursor-pointer"
              >
                <Download className="h-3 w-3 text-text-muted" />
                Excel
              </button>
              <button
                onClick={() => handleExport('pdf')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border-primary hover:border-border-secondary bg-panel-card text-text-primary text-[10px] font-semibold uppercase tracking-wider rounded transition-all cursor-pointer"
              >
                <Download className="h-3 w-3 text-text-muted" />
                PDF
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-panel-card/5 scrollbar-thin">
          {chatHistory.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-2 p-12 text-text-muted">
              <Cpu className="h-8 w-8 text-border-secondary" />
              <div className="text-xs font-semibold text-text-secondary">Ask your document questions</div>
              <p className="text-[10px] text-text-muted max-w-xs leading-relaxed">
                Provide queries such as "Create a side-by-side table comparing rates and terms" to contrast proposals.
              </p>
            </div>
          ) : (
            chatHistory.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col space-y-1.5 max-w-[85%] ${
                  msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
                }`}
              >
                <div className="text-[9px] text-text-muted font-mono">{msg.timestamp}</div>
                <div
                  className={`py-3 px-4 rounded-xl text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-text-primary text-background font-medium rounded-tr-none border border-border-primary'
                      : 'bg-panel-card text-text-primary border border-border-primary rounded-tl-none overflow-x-auto w-full'
                  }`}
                >
                  {msg.sender === 'user' ? (
                    msg.text
                  ) : (
                    <div className="prose prose-invert prose-xs max-w-none text-text-primary">
                      {msg.text.split('\n').map((line, idx) => {
                        if (line.startsWith('|')) {
                          return (
                            <div key={idx} className="font-mono whitespace-pre overflow-x-auto text-[11px] leading-tight text-text-secondary">
                              {line}
                            </div>
                          )
                        }
                        if (line.startsWith('###')) {
                          return (
                            <h4 key={idx} className="text-xs font-semibold text-text-primary mt-4 mb-2 uppercase tracking-wide">
                              {line.replace('###', '').trim()}
                            </h4>
                          )
                        }
                        if (line.startsWith('-')) {
                          return (
                            <li key={idx} className="list-none pl-2 text-text-secondary mb-1 text-[11px]">
                              {line}
                            </li>
                          )
                        }
                        return (
                          <p key={idx} className="mb-2 text-text-secondary">
                            {line}
                          </p>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {querying && (
            <div className="flex flex-col space-y-1.5 max-w-[80%] mr-auto items-start">
              <div className="py-3 px-4 rounded-xl bg-panel-card text-text-muted text-xs border border-border-primary rounded-tl-none flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-text-muted" />
                <span>Generating comparison matrix...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={handleQuerySubmit} className="p-6 border-t border-border-primary bg-panel-card/10 flex gap-2">
          <input
            type="text"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Compare the pricing structures of the uploaded quotation documents..."
            className="flex-1 bg-panel-card border border-border-primary text-text-primary placeholder-text-muted text-xs rounded-lg px-4 py-3 focus:outline-none focus:border-border-secondary transition-all font-sans"
          />
          <button
            type="submit"
            disabled={!queryText.trim() || querying}
            className="px-4 py-3 bg-text-primary hover:opacity-90 disabled:opacity-30 text-background font-semibold rounded-lg transition-all flex items-center justify-center cursor-pointer shrink-0"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </div>
  )
}

export default RAGPanel
