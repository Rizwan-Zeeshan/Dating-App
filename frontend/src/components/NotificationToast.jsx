import React, { useContext } from 'react'
import { FiX, FiMessageSquare, FiPhone, FiHash } from 'react-icons/fi'
import { ChatContext } from '../context/ChatContext.jsx'

/** Format milliseconds timestamp as HH:MM */
function fmtTs(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** Pick icon and class based on notification type */
function toastMeta(type) {
  switch (type) {
    case 'call': return { icon: <FiPhone size={18} />, cls: 'call' }
    case 'room': return { icon: <FiHash  size={18} />, cls: 'room' }
    default:     return { icon: <FiMessageSquare size={18} />, cls: 'message' }
  }
}

export default function NotificationToast() {
  const { state, dismissNotif } = useContext(ChatContext)
  const { notifications } = state

  if (notifications.length === 0) return null

  return (
    <div className="toast-stack" aria-live="polite" role="status">
      {notifications.map(n => {
        const { icon, cls } = toastMeta(n.type)
        return (
          <div
            key={n.id}
            id={`toast-${n.id}`}
            className="toast"
            onClick={() => dismissNotif(n.id)}
            role="alert"
          >
            <div className={`toast-icon ${cls}`}>{icon}</div>
            <div className="toast-body">
              <div className="toast-title">{n.title}</div>
              <div className="toast-message">{n.message}</div>
              <div className="toast-time">{fmtTs(n.ts)}</div>
            </div>
            <button
              className="toast-close"
              onClick={e => { e.stopPropagation(); dismissNotif(n.id) }}
              aria-label="Dismiss notification"
            >
              <FiX size={15} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
