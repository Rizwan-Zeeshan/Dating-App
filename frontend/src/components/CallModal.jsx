import React, { useState, useContext, useRef, useEffect } from 'react'
import {
  FiPhone, FiVideo, FiMic, FiMicOff, FiCamera, FiCameraOff,
  FiPhoneOff, FiPhoneCall,
} from 'react-icons/fi'
import { ChatContext, userColor } from '../context/ChatContext.jsx'
import { webrtc } from '../services/webrtc.js'

/** Format seconds as MM:SS */
function fmtDuration(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0')
  const s = (sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function CallModal() {
  const { state, acceptCall, declineCall, endCall, startCall } = useContext(ChatContext)
  const { incomingCall, activeCall, username } = state

  const [muted,       setMuted]       = useState(false)
  const [cameraOff,   setCameraOff]   = useState(false)
  const [duration,    setDuration]    = useState(0)
  const timerRef = useRef(null)

  const localVideoRef  = useRef(null)
  const remoteVideoRef = useRef(null)

  const isIncoming = !!incomingCall && !activeCall
  const partner    = activeCall?.with || incomingCall?.from
  const callType   = activeCall?.callType || incomingCall?.callType || 'video'
  const isVideo    = callType === 'video'

  // Start call timer when active call begins
  useEffect(() => {
    if (activeCall) {
      setDuration(0)
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [activeCall?.with])

  // Wire local/remote video elements after mounting
  useEffect(() => {
    if (!activeCall) return
    // Set local stream if already obtained
    if (webrtc.localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = webrtc.localStream
    }
    // Set remote stream if already received
    if (webrtc.remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = webrtc.remoteStream
    }
    // Register remote stream callback
    webrtc.onRemoteStream = stream => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream
    }
  }, [activeCall])

  const handleAccept = async () => {
    await acceptCall()
    if (localVideoRef.current && webrtc.localStream) {
      localVideoRef.current.srcObject = webrtc.localStream
    }
  }

  const handleToggleMute = () => {
    const nowMuted = webrtc.toggleMute()
    setMuted(nowMuted)
  }

  const handleToggleCamera = () => {
    const nowOff = webrtc.toggleCamera()
    setCameraOff(nowOff)
  }

  return (
    <div className="call-overlay">
      <div className="call-bg" />

      {/* Remote video (background) */}
      {activeCall && isVideo && (
        <div className="call-videos">
          <video
            id="remote-video"
            ref={remoteVideoRef}
            className="call-video-remote"
            autoPlay
            playsInline
          />
          <video
            id="local-video"
            ref={localVideoRef}
            className="call-video-local"
            autoPlay
            playsInline
            muted
          />
        </div>
      )}

      {/* Audio-only: show avatars over gradient bg */}
      {activeCall && !isVideo && (
        <>
          <video ref={localVideoRef}  autoPlay playsInline muted style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }} id="local-video" />
          <video ref={remoteVideoRef} autoPlay playsInline       style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }} id="remote-video" />
        </>
      )}

      {/* Call Info */}
      <div className="call-info">
        <div className="call-avatar-ring">
          {isIncoming && (
            <>
              <div className="ring" />
              <div className="ring" />
              <div className="ring" />
            </>
          )}
          <div
            className="avatar av-xl"
            style={{ background: userColor(partner), boxShadow: '0 0 40px rgba(124,58,237,0.4)' }}
          >
            {partner?.slice(0, 2).toUpperCase()}
          </div>
        </div>

        <div className="call-name">{partner}</div>

        <div className="call-status">
          {isIncoming
            ? `Incoming ${callType} call…`
            : activeCall
            ? (isVideo ? '📹 Video call' : '🎙️ Voice call')
            : 'Calling…'}
        </div>

        {activeCall && (
          <div className="call-timer">{fmtDuration(duration)}</div>
        )}
      </div>

      {/* Controls */}
      <div className="call-controls">
        {isIncoming ? (
          /* ── Incoming call buttons ── */
          <>
            <div className="call-btn" onClick={declineCall} style={{ cursor: 'pointer' }}>
              <div className="call-btn-circle end">
                <FiPhoneOff size={26} />
              </div>
              <span className="call-btn-label">Decline</span>
            </div>
            <div className="call-btn" onClick={handleAccept} style={{ cursor: 'pointer' }}>
              <div className="call-btn-circle accept">
                <FiPhoneCall size={26} />
              </div>
              <span className="call-btn-label">Accept</span>
            </div>
          </>
        ) : (
          /* ── Active call buttons ── */
          <>
            <div className="call-btn" onClick={handleToggleMute} style={{ cursor: 'pointer' }}>
              <div className={`call-btn-circle gray ${muted ? 'active' : ''}`}>
                {muted ? <FiMicOff size={20} /> : <FiMic size={20} />}
              </div>
              <span className="call-btn-label">{muted ? 'Unmute' : 'Mute'}</span>
            </div>

            {isVideo && (
              <div className="call-btn" onClick={handleToggleCamera} style={{ cursor: 'pointer' }}>
                <div className={`call-btn-circle gray ${cameraOff ? 'active' : ''}`}>
                  {cameraOff ? <FiCameraOff size={20} /> : <FiCamera size={20} />}
                </div>
                <span className="call-btn-label">{cameraOff ? 'Camera On' : 'Camera Off'}</span>
              </div>
            )}

            <div className="call-btn" onClick={endCall} style={{ cursor: 'pointer' }}>
              <div className="call-btn-circle end">
                <FiPhoneOff size={26} />
              </div>
              <span className="call-btn-label">End Call</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
