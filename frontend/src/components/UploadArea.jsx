import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileText, CheckCircle, XCircle, Loader, X, File, Sparkles } from 'lucide-react'
import { uploadDocument } from '../services/api'
import { useChat } from '../context/ChatContext'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'

function phaseLabel(progress) {
  if (progress < 100) return 'Uploading file stream…'
  return 'Generating vector embeddings & indexing context…'
}

function classifyError(err) {
  if (err.response) {
    const status = err.response.status
    const detail = err.response.data?.detail
    if (status === 401) return 'Please sign in before uploading.'
    if (status === 413) return 'File is too large. Please compress it and try again.'
    if (status === 422) return detail || 'File format invalid.'
    return detail || `Server error (${status}). Please try again.`
  }

  if (err.request) {
    return 'No response from server. Please check your backend connection.'
  }

  return `Unexpected error: ${err.message || 'unknown'}`
}

export default function UploadArea() {
  const { addDocument } = useChat()
  const navigate = useNavigate()

  const [status,       setStatus]       = useState('idle')
  const [progress,     setProgress]     = useState(0)
  const [errorMsg,     setErrorMsg]     = useState('')
  const [selectedFile, setSelectedFile] = useState(null)

  const onDrop = useCallback(async (acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      setStatus('error')
      setErrorMsg('Unsupported file type. Please upload PDF, DOCX, or TXT.')
      return
    }
    const file = acceptedFiles[0]
    if (!file) return

    setSelectedFile(file)
    setStatus('uploading')
    setProgress(0)
    setErrorMsg('')

    try {
      const data = await uploadDocument(file, (pct) => setProgress(pct))

      if (!data?.document_id) {
        throw new Error('Unexpected response from server — missing document_id.')
      }

      addDocument({
        chatId:     data.chat_id,
        documentId: data.document_id,
        id:         data.chat_id,
        name:       data.filename,
        chunks:     data.chunks_created,
        uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        file,
        fileUrl:    data.file_url ?? null,   
        pdfUrl:     data.pdf_url  ?? null,   
      })

      setStatus('success')
      // Instant seamless navigation to chat
      setTimeout(() => navigate('/chat'), 200)

    } catch (err) {
      console.error('[UploadArea] upload error:', err)
      setStatus('error')
      setErrorMsg(classifyError(err))
    }
  }, [addDocument, navigate])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
    disabled: status === 'uploading',
  })

  const reset = () => {
    setStatus('idle')
    setProgress(0)
    setSelectedFile(null)
    setErrorMsg('')
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      <AnimatePresence mode="wait">

        {/* ── Idle / Error Dropzone ─────────────────────────────── */}
        {(status === 'idle' || status === 'error') && (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
          >
            <div
              {...getRootProps()}
              className={clsx(
                'relative border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer transition-all duration-300 backdrop-blur-md',
                isDragActive
                  ? 'border-blue-500 bg-blue-600/10 shadow-2xl shadow-blue-500/20 scale-[1.01]'
                  : 'border-white/[0.12] bg-[#1E293B]/70 hover:border-blue-500/50 hover:bg-[#1E293B] shadow-xl'
              )}
            >
              <input {...getInputProps()} />
              
              <div className="flex flex-col items-center gap-4">
                <div className={clsx(
                  'w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-lg',
                  isDragActive
                    ? 'bg-blue-600 text-white shadow-blue-500/40 scale-110'
                    : 'bg-blue-600/15 border border-blue-500/30 text-blue-400'
                )}>
                  <Upload size={28} />
                </div>

                <div>
                  <p className="font-display font-bold text-white text-lg">
                    {isDragActive ? 'Drop your document here' : 'Drag & drop your file here'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1.5 font-medium">
                    or <span className="text-blue-400 hover:underline font-semibold">click to browse from computer</span>
                  </p>
                </div>

                {/* Supported Format Badges */}
                <div className="flex items-center gap-2 pt-2">
                  <span className="px-3 py-1 rounded-lg text-xs font-mono font-semibold bg-white/[0.04] border border-white/[0.08] text-slate-300">
                    PDF
                  </span>
                  <span className="px-3 py-1 rounded-lg text-xs font-mono font-semibold bg-white/[0.04] border border-white/[0.08] text-slate-300">
                    DOCX
                  </span>
                  <span className="px-3 py-1 rounded-lg text-xs font-mono font-semibold bg-white/[0.04] border border-white/[0.08] text-slate-300">
                    TXT
                  </span>
                </div>
              </div>
            </div>

            {status === 'error' && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 mt-4 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20"
              >
                <XCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-300 leading-relaxed flex-1">{errorMsg}</p>
                <button onClick={reset} className="text-red-400 hover:text-red-200 transition-colors">
                  <X size={16} />
                </button>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ── Uploading Progress ────────────────────────────────── */}
        {status === 'uploading' && (
          <motion.div
            key="uploading"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="bg-[#1E293B] border border-white/[0.1] rounded-3xl p-8 shadow-2xl"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0 text-blue-400">
                <FileText size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display font-bold text-white text-sm truncate">
                  {selectedFile?.name}
                </p>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  {(selectedFile?.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <Loader size={18} className="text-blue-400 animate-spin" />
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-between text-xs font-mono text-slate-400">
                <span>{phaseLabel(progress)}</span>
                <span className="text-blue-400 font-bold">{progress}%</span>
              </div>

              <div className="h-2 bg-navy-900 rounded-full overflow-hidden p-0.5 border border-white/[0.06]">
                <motion.div
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                  className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full shadow-lg shadow-blue-500/50"
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Success Card ──────────────────────────────────── */}
        {status === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-emerald-500/10 border border-emerald-500/30 rounded-3xl p-8 text-center shadow-2xl"
          >
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto mb-4 text-emerald-400 shadow-lg shadow-emerald-500/20">
              <CheckCircle size={30} />
            </div>
            <p className="font-display font-bold text-emerald-300 text-lg">
              Document Indexed Successfully!
            </p>
            <p className="text-xs text-slate-300 mt-1">{selectedFile?.name}</p>
            <p className="text-xs text-slate-400 font-mono mt-4 flex items-center justify-center gap-2">
              <Sparkles size={14} className="text-emerald-400" /> Redirecting to chat assistant…
            </p>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}
