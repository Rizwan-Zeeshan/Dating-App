import React, { useState, useContext } from 'react'
import {
  FiSearch, FiHash, FiUser, FiUsers, FiPlusCircle,
  FiMessageSquare, FiLogOut,
} from 'react-icons/fi'
import { ChatContext, userColor, dmKey, roomKey } from '../context/ChatContext.jsx'
import RoomModal from './RoomModal.jsx'

/** Render a circular avatar with initials and gradient background */
function Avatar({ name = '', size = 'av-sm', online = false }) {
  return (
    <div
      className={`avatar ${size}`}
      style={{ background: userColor(name), flexShrink: 0, position: 'relative' }}
    >
      {name.slice(0, 2).toUpperCase()}
      {online && <span className="online-dot" />}
    </div>
  )
}

/** Format timestamp to HH:MM */
function fmtTime(ts) {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** Get the last message preview for a chat key */
function getLastMsg(messages, chatKey) {
  const msgs = messages[chatKey] || []
  const last = msgs[msgs.length - 1]
  if (!last || last.msg_type === 'system') return null
  return last
}

export default function Sidebar() {
  const { state, setActiveChat, disconnect } = useContext(ChatContext)
  const { username, users, rooms, myRoomIds, activeChat, unread, generalRoomId, messages } = state

  const [tab, setTab] = useState('chats')   // 'chats' | 'groups' | 'people'
  const [search, setSearch] = useState('')
  const [showRoomModal, setShowRoomModal] = useState(false)

  // People = all users except self
  const otherUsers = users.filter(u => u.username !== username)

  // Rooms the current user is a member of
  const myRooms = rooms.filter(r => myRoomIds.includes(r.id) || r.id === generalRoomId)

  // Filter by search
  const q = search.toLowerCase()
  const filteredUsers = otherUsers.filter(u => u.username.toLowerCase().includes(q))
  const filteredRooms = myRooms.filter(r => r.name.toLowerCase().includes(q))

  const handleUserClick = (u) => {
    setActiveChat({ type: 'dm', id: u.username, name: u.username })
  }

  const handleRoomClick = (r) => {
    setActiveChat({ type: 'room', id: r.id, name: r.name })
  }

  const isActive = (type, id) => activeChat?.type === type && activeChat?.id === id

  return (
    <aside className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <Avatar name={username} size="av-md" online />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sidebar-username">{username}</div>
          <div className="sidebar-status">
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
            Online
          </div>
        </div>
        <button
          id="logout-btn"
          className="icon-btn danger"
          title="Disconnect"
          onClick={disconnect}
          style={{ flexShrink: 0 }}
        >
          <FiLogOut size={15} />
        </button>
      </div>

      {/* Search */}
      <div className="sidebar-search">
        <FiSearch className="sidebar-search-icon" />
        <input
          id="sidebar-search"
          placeholder="Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Tabs */}
      <div className="sidebar-tabs">
        {[
          { key: 'chats',   label: 'Chats',   icon: <FiMessageSquare size={13} /> },
          { key: 'groups',  label: 'Groups',  icon: <FiHash size={13} /> },
          { key: 'people',  label: 'People',  icon: <FiUsers size={13} /> },
        ].map(t => (
          <button
            key={t.key}
            id={`tab-${t.key}`}
            className={`tab-btn ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Lists */}
      <div className="sidebar-list">

        {/* ── Chats tab — DM conversations ── */}
        {tab === 'chats' && (
          <>
            <div className="section-label">Direct Messages</div>
            {filteredUsers.length === 0 && (
              <div style={{ padding: '16px 8px', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
                No other users online yet.
              </div>
            )}
            {filteredUsers.map(u => {
              const key = dmKey(username, u.username)
              const last = getLastMsg(messages, key)
              const unreadCount = unread[key] || 0
              return (
                <div
                  key={u.username}
                  id={`dm-${u.username}`}
                  className={`chat-item ${isActive('dm', u.username) ? 'active' : ''}`}
                  onClick={() => handleUserClick(u)}
                >
                  <Avatar name={u.username} size="av-sm" online />
                  <div className="item-info">
                    <div className="item-name">{u.username}</div>
                    <div className="item-sub">
                      {last
                        ? (last.msg_type !== 'text' ? `📎 ${last.file_name || 'File'}` : last.content)
                        : 'Click to start a conversation'}
                    </div>
                  </div>
                  <div className="item-right">
                    {last && <div className="item-time">{fmtTime(last.timestamp)}</div>}
                    {unreadCount > 0 && <div className="unread-badge">{unreadCount > 9 ? '9+' : unreadCount}</div>}
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* ── Groups tab ── */}
        {tab === 'groups' && (
          <>
            <div className="section-label">My Rooms</div>
            {filteredRooms.map(r => {
              const key = roomKey(r.id)
              const last = getLastMsg(messages, key)
              const unreadCount = unread[key] || 0
              return (
                <div
                  key={r.id}
                  id={`room-${r.id}`}
                  className={`chat-item ${isActive('room', r.id) ? 'active' : ''}`}
                  onClick={() => handleRoomClick(r)}
                >
                  <div className="avatar av-sm" style={{
                    background: 'var(--accent-light)',
                    border: '1px solid rgba(124,58,237,0.25)',
                    color: 'var(--text-accent)',
                    fontSize: 16,
                  }}>
                    <FiHash size={16} />
                  </div>
                  <div className="item-info">
                    <div className="item-name">{r.name}</div>
                    <div className="item-sub">
                      {last ? last.content : `${r.members.length} member${r.members.length !== 1 ? 's' : ''}`}
                    </div>
                  </div>
                  <div className="item-right">
                    {last && <div className="item-time">{fmtTime(last.timestamp)}</div>}
                    {unreadCount > 0 && <div className="unread-badge">{unreadCount > 9 ? '9+' : unreadCount}</div>}
                  </div>
                </div>
              )
            })}

            <button
              id="create-room-btn"
              className="add-room-btn"
              onClick={() => setShowRoomModal(true)}
            >
              <FiPlusCircle size={16} />
              Create or join a room
            </button>
          </>
        )}

        {/* ── People tab — all online users ── */}
        {tab === 'people' && (
          <>
            <div className="section-label">{otherUsers.length} Online</div>
            {filteredUsers.map(u => (
              <div
                key={u.username}
                id={`person-${u.username}`}
                className={`chat-item ${isActive('dm', u.username) ? 'active' : ''}`}
                onClick={() => { handleUserClick(u); setTab('chats') }}
              >
                <Avatar name={u.username} size="av-sm" online />
                <div className="item-info">
                  <div className="item-name">{u.username}</div>
                  <div className="item-sub" style={{ color: 'var(--green)', fontSize: 11 }}>● Active now</div>
                </div>
                <div style={{
                  padding: '4px 10px',
                  background: 'var(--accent-light)',
                  color: 'var(--text-accent)',
                  borderRadius: 'var(--r-full)',
                  fontSize: 11,
                  fontWeight: 600,
                }}>
                  Message
                </div>
              </div>
            ))}
            {filteredUsers.length === 0 && (
              <div style={{ padding: '16px 8px', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
                No other users online.
              </div>
            )}
          </>
        )}
      </div>

      {showRoomModal && <RoomModal onClose={() => setShowRoomModal(false)} />}
    </aside>
  )
}
