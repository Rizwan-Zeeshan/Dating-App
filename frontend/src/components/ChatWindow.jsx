import React, {
  useContext, useRef, useEffect, useState, useCallback,
} from 'react'
import {
  FiPhone, FiVideo, FiPaperclip, FiSend, FiSmile,
  FiHash, FiUser, FiMoreVertical, FiLogOut,
} from 'react-icons/fi'
import EmojiPicker from 'emoji-picker-react'
import { ChatContext, userColor, roomKey, dmKey } from '../context/ChatContext.jsx'
import MessageBubble from './MessageBubble.jsx'

/** Compute the chatKey for the active chat */
function getChatKey(activeChat, username) {
  if (!activeChat) return null
  return activeChat.type === 'room'
    ? roomKey(activeChat.id)
    : dmKey(username, activeChat.id)
}

/** Get typing label string */
function getTypingLabel(typingList, username) {
  const others = typingList.filter(u => u !== username)
  if (others.length === 0) return null
  if (others.length === 1) return `${others[0]} is typing`
  return `${others.join(', ')} are typing`
}

export default function ChatWindow() {
  const { state, sendMessage, sendFile, sendTyping, startCall, leaveRoom } = useContext(ChatContext)
  const { username, activeChat, messages, typing, rooms } = state

  const chatKey = getChatKey(activeChat, username)
  const msgs    = chatKey ? (messages[chatKey] || []) : []

  const [text, setText]           = useState('')
  const [showEmoji, setShowEmoji] = useState(false)

  const messagesEndRef = useRef(null)
  const fileInputRef   = useRef(null)
  const textareaRef    = useRef(null)
  const typingTimer    = useRef(null)
  const wasTyping      = useRef(false)

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs.length])

  // Reset text when switching chats
  useEffect(() => {
    setText('')
    setShowEmoji(false)
    textareaRef.current?.focus()
  }, [chatKey])

  // Typing indicator logic
  const handleTyping = useCallback((value) => {
    setText(value)
    if (!wasTyping.current) {
      wasTyping.current = true
      sendTyping(true)
    }
    clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => {
      wasTyping.current = false
      sendTyping(false)
    }, 1500)
  }, [sendTyping])

  const handleSend = useCallback(() => {
    if (!text.trim()) return
    sendMessage(text)
    setText('')
    wasTyping.current = false
    clearTimeout(typingTimer.current)
    sendTyping(false)
    textareaRef.current?.focus()
  }, [text, sendMessage, sendTyping])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0]
    if (file) sendFile(file)
    e.target.value = ''
  }, [sendFile])

  const handleEmojiClick = useCallback((emojiData) => {
    setText(t => t + emojiData.emoji)
    textareaRef.current?.focus()
  }, [])

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmoji) return
    const handler = (e) => {
      if (!e.target.closest('.emoji-picker-wrapper') && !e.target.closest('#emoji-toggle-btn')) {
        setShowEmoji(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showEmoji])

  // Get room info if group chat
  const room = activeChat?.type === 'room' ? rooms.find(r => r.id === activeChat.id) : null

  /* ── Empty state ─────────────────────────────────────────── */
  if (!activeChat) {
    return (
      <div className="chat-window">
        <div className="chat-empty">
          <div className="chat-empty-icon">💬</div>
          <h2>Welcome to ChatSpace</h2>
          <p>Select a person or group from the sidebar to start chatting in real-time.</p>
          <div style={{ marginTop: 8, display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-muted)' }}>
            <span>📞 Voice calls</span>
            <span>📹 Video calls</span>
            <span>📎 File sharing</span>
          </div>
        </div>
      </div>
    )
  }

  /* ── Typing label ─────────────────────────────────────────── */
  const typingUsers = typing[chatKey] || []
  const typingLabel = getTypingLabel(typingUsers, username)

  /* ── Resolve header subtitle ────────────────────────────────── */
  let subtitle = ''
  if (activeChat.type === 'room' && room) {
    subtitle = `${room.members.length} member${room.members.length !== 1 ? 's' : ''}`
  } else {
    subtitle = 'Online'
  }

  return (
    <div className="chat-window">
      {/* ── Header ── */}
      <div className="chat-header">
        {activeChat.type === 'room' ? (
          <div className="avatar av-md" style={{
            background: 'var(--accent-light)',
            border: '1px solid rgba(124,58,237,0.25)',
            color: 'var(--text-accent)',
          }}>
            <FiHash size={20} />
          </div>
        ) : (
          <div className="avatar av-md" style={{ background: userColor(activeChat.name) }}>
            {activeChat.name.slice(0, 2).toUpperCase()}
          </div>
        )}

        <div className="chat-header-info">
          <div className="chat-header-name">{activeChat.name}</div>
          <div className="chat-header-sub">
            {activeChat.type === 'room' ? (
              <><FiHash size={10} style={{ marginRight: 3 }} />{subtitle}</>
            ) : (
              <span style={{ color: 'var(--green)' }}>● {subtitle}</span>
            )}
          </div>
        </div>

        <div className="chat-header-actions">
          {activeChat.type === 'dm' && (
            <>
              <button
                id={`voice-call-${activeChat.id}`}
                className="icon-btn"
                title="Voice call"
                onClick={() => startCall(activeChat.id, 'audio')}
              >
                <FiPhone size={16} />
              </button>
              <button
                id={`video-call-${activeChat.id}`}
                className="icon-btn"
                title="Video call"
                onClick={() => startCall(activeChat.id, 'video')}
              >
                <FiVideo size={16} />
              </button>
            </>
          )}
          {activeChat.type === 'room' && activeChat.id !== state.generalRoomId && (
            <button
              id={`leave-room-${activeChat.id}`}
              className="icon-btn danger"
              title="Leave room"
              onClick={() => leaveRoom(activeChat.id)}
            >
              <FiLogOut size={15} />
            </button>
          )}
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="messages-area" id="messages-area">
        {msgs.length === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              <p>No messages yet.</p>
              <p style={{ marginTop: 6 }}>Say hello! 👋</p>
            </div>
          </div>
        )}
        {msgs.map((msg, i) => (
          <MessageBubble key={msg.id || i} msg={msg} isSelf={msg.sender === username} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Typing Indicator ── */}
      <div className="typing-indicator">
        {typingLabel && (
          <>
            <div className="typing-dots">
              <span /><span /><span />
            </div>
            {typingLabel}
          </>
        )}
      </div>

      {/* ── Input Area ── */}
      <div className="input-area">
        {/* Emoji Picker */}
        {showEmoji && (
          <div className="emoji-picker-wrapper">
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              theme="dark"
              height={380}
              width={320}
              searchDisabled={false}
              skinTonesDisabled
            />
          </div>
        )}

        {/* Hidden file input */}
        <input
          id="file-input"
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={handleFileChange}
          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt"
        />

        {/* Input box */}
        <div className="input-box">
          <button
            id="emoji-toggle-btn"
            className="input-icon-btn"
            title="Emoji"
            onClick={() => setShowEmoji(v => !v)}
          >
            <FiSmile />
          </button>

          <textarea
            ref={textareaRef}
            id="message-input"
            placeholder={`Message ${activeChat?.type === 'room' ? '#' + activeChat.name : activeChat.name}…`}
            value={text}
            onChange={e => handleTyping(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            style={{ resize: 'none' }}
          />

          <button
            id="attach-btn"
            className="input-icon-btn"
            title="Attach file"
            onClick={() => fileInputRef.current?.click()}
          >
            <FiPaperclip />
          </button>
        </div>

        {/* Send button */}
        <button
          id="send-btn"
          className="send-btn"
          disabled={!text.trim()}
          onClick={handleSend}
          title="Send (Enter)"
        >
          <FiSend size={16} />
        </button>
      </div>
    </div>
  )
}
