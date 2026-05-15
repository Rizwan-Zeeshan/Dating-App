import React, { useState, useContext } from 'react'
import { FiWifi, FiUser, FiAlertCircle, FiMessageCircle } from 'react-icons/fi'
import { ChatContext } from '../context/ChatContext.jsx'

export default function Login() {
  const { state, connect } = useContext(ChatContext)
  const [serverIP, setServerIP] = useState(window.location.hostname || 'localhost')
  const [username, setUsername] = useState('')

  const handleConnect = e => {
    e.preventDefault()
    if (!username.trim() || !serverIP.trim()) return
    connect(serverIP.trim(), username.trim())
  }

  return (
    <div className="login-page">
      <div className="login-bg" />

      {/* Floating orbs for depth */}
      <div style={{
        position: 'absolute', width: 400, height: 400,
        borderRadius: '50%', top: '-10%', left: '-5%',
        background: 'radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)',
        filter: 'blur(40px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: 300, height: 300,
        borderRadius: '50%', bottom: '-5%', right: '5%',
        background: 'radial-gradient(circle, rgba(79,70,229,0.10) 0%, transparent 70%)',
        filter: 'blur(30px)', pointerEvents: 'none',
      }} />

      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">💬</div>

        <h1 className="login-title">ChatSpace</h1>
        <p className="login-subtitle">Real-time multi-user chat over LAN/Wi-Fi</p>

        {/* Error */}
        {state.error && (
          <div className="login-error" style={{ marginBottom: 20 }}>
            <FiAlertCircle size={16} />
            {state.error}
          </div>
        )}

        <form className="login-form" onSubmit={handleConnect}>
          <div className="form-field">
            <label className="form-label" htmlFor="server-ip">Server IP Address</label>
            <div style={{ position: 'relative' }}>
              <FiWifi style={{
                position: 'absolute', left: 14, top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)', fontSize: 15,
              }} />
              <input
                id="server-ip"
                className="form-input"
                style={{ paddingLeft: 40 }}
                type="text"
                placeholder="localhost or 192.168.x.x"
                value={serverIP}
                onChange={e => setServerIP(e.target.value)}
                autoCapitalize="off"
                autoComplete="off"
                spellCheck="false"
              />
            </div>
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="username">Your Username</label>
            <div style={{ position: 'relative' }}>
              <FiUser style={{
                position: 'absolute', left: 14, top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)', fontSize: 15,
              }} />
              <input
                id="username"
                className="form-input"
                style={{ paddingLeft: 40 }}
                type="text"
                placeholder="e.g. Alice"
                value={username}
                onChange={e => setUsername(e.target.value)}
                maxLength={24}
                autoFocus
              />
            </div>
          </div>

          <button
            id="connect-btn"
            className="connect-btn"
            type="submit"
            disabled={state.isConnecting || !username.trim() || !serverIP.trim()}
          >
            {state.isConnecting ? (
              <>
                <div className="spinner" />
                Connecting…
              </>
            ) : (
              <>
                <FiMessageCircle size={18} />
                Connect to ChatSpace
              </>
            )}
          </button>
        </form>

        <p style={{ marginTop: 28, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Computer Networking Project — Python Socket Programming<br />
          Ensure the server is running before connecting.
        </p>
      </div>
    </div>
  )
}
