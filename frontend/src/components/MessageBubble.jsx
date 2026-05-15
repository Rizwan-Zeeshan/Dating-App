import React, { useState, useContext } from 'react'
import { FiShare2, FiCopy, FiDownload, FiFile, FiCheckCircle } from 'react-icons/fi'
import { ChatContext, fmtTime, fmtSize } from '../context/ChatContext.jsx'
import ForwardModal from './ForwardModal.jsx'

/** Download a base64 file */
function downloadFile(base64, filename) {
  const a = document.createElement('a')
  a.href = base64
  a.download = filename
  a.click()
}

/** Get a file-type emoji icon */
function fileIcon(name = '') {
  const ext = name.split('.').pop().toLowerCase()
  const icons = { pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', zip: '🗜️', mp3: '🎵', txt: '📃' }
  return icons[ext] || '📎'
}

export default function MessageBubble({ msg, isSelf }) {
  const { forwardMessage } = useContext(ChatContext)
  const [showForward, setShowForward] = useState(false)
  const [copied, setCopied]           = useState(false)
  const [lightbox, setLightbox]       = useState(false)

  const { msg_type, sender, content, timestamp, file_name, file_size, forwarded_from } = msg

  /* ── System message ──────────────────────────────────────────── */
  if (msg_type === 'system') {
    return (
      <div className="msg-wrapper system">
        <div className="msg-bubble system">{content}</div>
      </div>
    )
  }

  const wrapperClass = `msg-wrapper ${isSelf ? 'sent' : 'recv'}`
  const bubbleClass  = `msg-bubble ${isSelf ? 'sent' : 'recv'}`

  const handleCopy = () => {
    if (msg_type === 'text') {
      navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  const handleForward = (destRoomId, destUser) => {
    forwardMessage(msg, destRoomId, destUser)
    setShowForward(false)
  }

  /* ── Content renderer ────────────────────────────────────────── */
  const renderContent = () => {
    if (msg_type === 'image') {
      return (
        <>
          <img
            src={content}
            alt={file_name || 'image'}
            className="msg-image"
            onClick={() => setLightbox(true)}
            loading="lazy"
          />
          {lightbox && (
            <div
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
                zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'zoom-out',
              }}
              onClick={() => setLightbox(false)}
            >
              <img src={content} alt="preview" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12 }} />
            </div>
          )}
        </>
      )
    }

    if (msg_type === 'video') {
      return (
        <video
          src={content}
          className="msg-video"
          controls
          preload="metadata"
          style={{ maxWidth: 300 }}
        />
      )
    }

    if (msg_type === 'file') {
      return (
        <div className="msg-file-card" onClick={() => downloadFile(content, file_name || 'file')}>
          <div className="msg-file-icon">{fileIcon(file_name)}</div>
          <div className="msg-file-info">
            <div className="msg-file-name">{file_name || 'Unknown file'}</div>
            <div className="msg-file-size">{fmtSize(file_size)} · Click to download</div>
          </div>
          <FiDownload size={16} style={{ color: 'var(--text-muted)' }} />
        </div>
      )
    }

    // text
    return <span style={{ whiteSpace: 'pre-wrap' }}>{content}</span>
  }

  return (
    <>
      <div className={wrapperClass}>
        {/* Sender name (only for received messages) */}
        {!isSelf && <div className="msg-sender">{sender}</div>}

        {/* Hover actions */}
        <div className="msg-actions">
          <button
            className="msg-action-btn"
            title="Forward"
            onClick={() => setShowForward(true)}
          >
            <FiShare2 size={13} />
          </button>
          {msg_type === 'text' && (
            <button
              className="msg-action-btn"
              title="Copy"
              onClick={handleCopy}
            >
              {copied ? <FiCheckCircle size={13} style={{ color: 'var(--green)' }} /> : <FiCopy size={13} />}
            </button>
          )}
          {(msg_type === 'image' || msg_type === 'video' || msg_type === 'file') && (
            <button
              className="msg-action-btn"
              title="Download"
              onClick={() => downloadFile(content, file_name)}
            >
              <FiDownload size={13} />
            </button>
          )}
        </div>

        <div className={bubbleClass}>
          {/* Forwarded label */}
          {forwarded_from && (
            <div className="msg-forwarded">
              <FiShare2 size={11} />
              Forwarded from {forwarded_from}
            </div>
          )}
          {renderContent()}
        </div>

        <div className="msg-footer">
          <span className="msg-time">{fmtTime(timestamp)}</span>
        </div>
      </div>

      {/* Forward modal */}
      {showForward && (
        <ForwardModal
          msg={msg}
          onForward={handleForward}
          onClose={() => setShowForward(false)}
        />
      )}
    </>
  )
}
