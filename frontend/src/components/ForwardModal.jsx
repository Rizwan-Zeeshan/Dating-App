import React, { useState, useContext } from 'react'
import { FiX, FiSearch, FiHash, FiUser, FiCheck } from 'react-icons/fi'
import { ChatContext, userColor } from '../context/ChatContext.jsx'

export default function ForwardModal({ msg, onForward, onClose }) {
  const { state } = useContext(ChatContext)
  const { users, rooms, myRoomIds, username, generalRoomId } = state

  const [search,   setSearch]   = useState('')
  const [selected, setSelected] = useState(null)  // { type:'room'|'dm', id, name }

  const q = search.toLowerCase()

  // Rooms the user is in (for forwarding)
  const myRooms   = rooms.filter(r => myRoomIds.includes(r.id) || r.id === generalRoomId)
  const otherUsers = users.filter(u => u.username !== username)

  const filteredRooms = myRooms.filter(r => r.name.toLowerCase().includes(q))
  const filteredUsers = otherUsers.filter(u => u.username.toLowerCase().includes(q))

  const toggle = (item) => {
    setSelected(s => s?.id === item.id ? null : item)
  }

  const handleForward = () => {
    if (!selected) return
    if (selected.type === 'room') {
      onForward(selected.id, null)
    } else {
      onForward(null, selected.id)
    }
  }

  const isSelected = (id) => selected?.id === id

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">↪ Forward Message</h2>
          <button id="forward-modal-close" className="modal-close" onClick={onClose}><FiX /></button>
        </div>

        {/* Original message preview */}
        <div style={{
          padding: '10px 14px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-sm)',
          marginBottom: 16,
          fontSize: 13,
          color: 'var(--text-secondary)',
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
            From {msg.sender}:
          </div>
          <div style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {msg.msg_type === 'text'
              ? msg.content.slice(0, 80)
              : `📎 ${msg.file_name || 'File'}`}
          </div>
        </div>

        {/* Search */}
        <div className="forward-search">
          <FiSearch className="forward-search-icon" />
          <input
            id="forward-search"
            placeholder="Search people or rooms…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        {/* List */}
        <div className="forward-list">
          {filteredRooms.length > 0 && (
            <>
              <div style={{ padding: '4px 8px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                Rooms
              </div>
              {filteredRooms.map(r => (
                <div
                  key={r.id}
                  id={`forward-room-${r.id}`}
                  className={`forward-item ${isSelected(r.id) ? 'selected' : ''}`}
                  onClick={() => toggle({ type: 'room', id: r.id, name: r.name })}
                >
                  <div className="avatar av-sm" style={{ background: 'var(--accent-light)', color: 'var(--text-accent)' }}>
                    <FiHash size={14} />
                  </div>
                  <div>
                    <div className="forward-item-name">#{r.name}</div>
                    <div className="forward-item-sub">{r.members.length} members</div>
                  </div>
                  {isSelected(r.id) && <FiCheck className="forward-check" />}
                </div>
              ))}
            </>
          )}

          {filteredUsers.length > 0 && (
            <>
              <div style={{ padding: '8px 8px 4px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                People
              </div>
              {filteredUsers.map(u => (
                <div
                  key={u.username}
                  id={`forward-user-${u.username}`}
                  className={`forward-item ${isSelected(u.username) ? 'selected' : ''}`}
                  onClick={() => toggle({ type: 'dm', id: u.username, name: u.username })}
                >
                  <div className="avatar av-sm" style={{ background: userColor(u.username) }}>
                    {u.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="forward-item-name">{u.username}</div>
                    <div className="forward-item-sub" style={{ color: 'var(--green)' }}>● Online</div>
                  </div>
                  {isSelected(u.username) && <FiCheck className="forward-check" />}
                </div>
              ))}
            </>
          )}

          {filteredRooms.length === 0 && filteredUsers.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No results found.
            </div>
          )}
        </div>

        {/* Action */}
        <button
          id="forward-send-btn"
          className="action-btn primary"
          disabled={!selected}
          onClick={handleForward}
        >
          ↪ Forward to {selected ? (selected.type === 'room' ? '#' + selected.name : selected.name) : '…'}
        </button>
      </div>
    </div>
  )
}
