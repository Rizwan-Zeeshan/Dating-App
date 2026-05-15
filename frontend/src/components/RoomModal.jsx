import React, { useState, useContext } from 'react'
import { FiX, FiHash, FiUsers } from 'react-icons/fi'
import { ChatContext } from '../context/ChatContext.jsx'

export default function RoomModal({ onClose }) {
  const { state, createRoom, joinRoom } = useContext(ChatContext)
  const { rooms, myRoomIds, username }  = state

  const [tab,      setTab]      = useState('create')  // 'create' | 'join'
  const [name,     setName]     = useState('')
  const [loading,  setLoading]  = useState(false)

  // Rooms the user is NOT yet a member of
  const joinableRooms = rooms.filter(r => !myRoomIds.includes(r.id) && r.id !== state.generalRoomId)

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    createRoom(name.trim())
    setLoading(false)
    onClose()
  }

  const handleJoin = (roomId) => {
    joinRoom(roomId)
    onClose()
  }

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'var(--accent-light)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: 'var(--text-accent)',
            }}>
              <FiHash size={18} />
            </div>
            <h2 className="modal-title">Chat Rooms</h2>
          </div>
          <button id="room-modal-close" className="modal-close" onClick={onClose}><FiX /></button>
        </div>

        {/* Tabs */}
        <div className="room-tabs">
          <button
            id="tab-create-room"
            className={`room-tab ${tab === 'create' ? 'active' : ''}`}
            onClick={() => setTab('create')}
          >
            + Create Room
          </button>
          <button
            id="tab-join-room"
            className={`room-tab ${tab === 'join' ? 'active' : ''}`}
            onClick={() => setTab('join')}
          >
            <FiUsers size={13} style={{ marginRight: 4 }} />
            Join Room ({joinableRooms.length})
          </button>
        </div>

        {/* Create tab */}
        {tab === 'create' && (
          <form className="room-create-form" onSubmit={handleCreate}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Room Name
              </label>
              <input
                id="room-name-input"
                placeholder="e.g. Study Group, Project Alpha…"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={32}
                autoFocus
              />
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Anyone on the server can browse and join your room.
            </p>
            <button
              id="create-room-submit"
              className="action-btn primary"
              type="submit"
              disabled={!name.trim() || loading}
            >
              <FiHash size={16} />
              Create #{name.trim() || 'room'}
            </button>
          </form>
        )}

        {/* Join tab */}
        {tab === 'join' && (
          <>
            {joinableRooms.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 14 }}>
                No rooms to join right now.<br />
                <span style={{ fontSize: 12 }}>Create one and invite others!</span>
              </div>
            ) : (
              <div className="room-list-scroll">
                {joinableRooms.map(r => (
                  <div key={r.id} className="room-list-item">
                    <div className="room-list-item-icon">
                      <FiHash size={16} />
                    </div>
                    <div className="room-list-item-info">
                      <div className="room-list-item-name">#{r.name}</div>
                      <div className="room-list-item-sub">
                        {r.members.length} member{r.members.length !== 1 ? 's' : ''} · by {r.created_by}
                      </div>
                    </div>
                    <button
                      id={`join-room-${r.id}`}
                      className="room-join-btn"
                      onClick={() => handleJoin(r.id)}
                    >
                      Join
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
