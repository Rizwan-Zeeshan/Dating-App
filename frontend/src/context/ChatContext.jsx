/**
 * ChatContext.jsx — Global State Management + WebSocket Handler
 *
 * Provides:
 *  - Full app state via React Context + useReducer
 *  - WebSocket connection management (connect / disconnect / reconnect)
 *  - All server message handlers
 *  - WebRTC call signaling hooks
 *  - Action creators for all user interactions
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useRef,
  useCallback,
  useEffect,
} from 'react'
import { webrtc } from '../services/webrtc.js'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Generate a chat key for room messages */
export const roomKey = id => `room_${id}`

/** Generate a chat key for DM conversations (order-independent) */
export const dmKey = (a, b) => `dm_${[a, b].sort().join('|')}`

/** Generate a simple unique ID */
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

/** Generate a gradient color from a username string */
export function userColor(name = '') {
  const palette = [
    'linear-gradient(135deg,#7c3aed,#4f46e5)',
    'linear-gradient(135deg,#db2777,#9333ea)',
    'linear-gradient(135deg,#059669,#0891b2)',
    'linear-gradient(135deg,#d97706,#dc2626)',
    'linear-gradient(135deg,#2563eb,#7c3aed)',
    'linear-gradient(135deg,#be185d,#7c3aed)',
    'linear-gradient(135deg,#0891b2,#059669)',
    'linear-gradient(135deg,#b45309,#d97706)',
  ]
  let h = 0
  for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h)
  return palette[Math.abs(h) % palette.length]
}

/** Format a Unix timestamp as a short time string */
export function fmtTime(ts) {
  const d = new Date(ts * 1000)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** Format file size bytes as a readable string */
export function fmtSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// ─────────────────────────────────────────────────────────────────────────────
// Web Audio — Sound notifications (no external files required)
// ─────────────────────────────────────────────────────────────────────────────

function playSound(type = 'message') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    if (type === 'message') {
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.1)
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
      osc.start(); osc.stop(ctx.currentTime + 0.25)
    } else if (type === 'call') {
      // Two-tone ring
      osc.type = 'sine'
      osc.frequency.setValueAtTime(440, ctx.currentTime)
      osc.frequency.setValueAtTime(480, ctx.currentTime + 0.3)
      osc.frequency.setValueAtTime(440, ctx.currentTime + 0.6)
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.setValueAtTime(0, ctx.currentTime + 0.9)
      osc.start(); osc.stop(ctx.currentTime + 0.9)
    }
  } catch (_) { /* AudioContext may be blocked before user interaction */ }
}

function showBrowserNotification(title, body) {
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico', silent: true })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// State & Reducer
// ─────────────────────────────────────────────────────────────────────────────

const INIT = {
  username:      null,
  serverIP:      'localhost',
  isConnected:   false,
  isConnecting:  false,
  error:         null,

  users:         [],
  rooms:         [],
  generalRoomId: null,
  myRoomIds:     [],

  messages:      {},  // { chatKey: Message[] }
  activeChat:    null, // { type:'room'|'dm', id:string, name:string }
  unread:        {},   // { chatKey: number }
  typing:        {},   // { chatKey: string[] }

  incomingCall:  null, // { from, callType, offer }
  activeCall:    null, // { with: string, callType: string }

  notifications: [],   // { id, type, title, message, ts }
}

function reducer(state, action) {
  switch (action.type) {

    case 'CONNECTING':
      return { ...state, isConnecting: true, error: null }

    case 'CONNECTED':
      return { ...state, isConnecting: false, isConnected: true, error: null, username: action.username, generalRoomId: action.generalRoomId }

    case 'DISCONNECTED':
      return { ...INIT, serverIP: state.serverIP, error: action.error || null }

    case 'SET_USERS':
      return { ...state, users: action.users }

    case 'SET_ROOMS': {
      const myRoomIds = action.rooms
        .filter(r => r.members.includes(state.username))
        .map(r => r.id)
      return { ...state, rooms: action.rooms, myRoomIds }
    }

    case 'ADD_MESSAGE': {
      const { chatKey, msg } = action
      const existing = state.messages[chatKey] || []
      // Avoid duplicate message IDs
      if (existing.some(m => m.id === msg.id)) return state
      return {
        ...state,
        messages: { ...state.messages, [chatKey]: [...existing, msg] },
        unread: state.activeChat?.id === (msg.room_id || (msg.target_user === state.username ? msg.sender : msg.target_user))
          ? state.unread
          : { ...state.unread, [chatKey]: (state.unread[chatKey] || 0) + 1 },
      }
    }

    case 'SET_ACTIVE_CHAT':
      return {
        ...state,
        activeChat: action.chat,
        unread: { ...state.unread, [action.chatKey]: 0 },
      }

    case 'SET_TYPING': {
      const { chatKey, username, isTyping } = action
      const prev = state.typing[chatKey] || []
      const next = isTyping
        ? [...new Set([...prev, username])]
        : prev.filter(u => u !== username)
      return { ...state, typing: { ...state.typing, [chatKey]: next } }
    }

    case 'SET_INCOMING_CALL':
      return { ...state, incomingCall: action.call }

    case 'SET_ACTIVE_CALL':
      return { ...state, activeCall: action.call, incomingCall: null }

    case 'CALL_ENDED':
      return { ...state, incomingCall: null, activeCall: null }

    case 'ADD_NOTIFICATION':
      return { ...state, notifications: [...state.notifications, action.notif] }

    case 'REMOVE_NOTIFICATION':
      return { ...state, notifications: state.notifications.filter(n => n.id !== action.id) }

    case 'SET_ERROR':
      return { ...state, error: action.error, isConnecting: false }

    default:
      return state
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

export const ChatContext = createContext(null)

export function ChatProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INIT)
  const wsRef    = useRef(null)
  const stateRef = useRef(state)
  stateRef.current = state

  // Request browser notification permission on mount
  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // ── Send helper ───────────────────────────────────────────────────────────
  const send = useCallback((type, payload) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, payload }))
    }
  }, [])

  // ── Toast helper ─────────────────────────────────────────────────────────
  const addToast = useCallback((type, title, message) => {
    const id = uid()
    dispatch({ type: 'ADD_NOTIFICATION', notif: { id, type, title, message, ts: Date.now() } })
    setTimeout(() => dispatch({ type: 'REMOVE_NOTIFICATION', id }), 5000)
    playSound(type === 'call' ? 'call' : 'message')
    showBrowserNotification(title, message)
  }, [])

  // ── Incoming message dispatcher ───────────────────────────────────────────
  const handleMessage = useCallback((raw) => {
    let data
    try { data = JSON.parse(raw) } catch { return }

    const { type, payload } = data
    const s = stateRef.current

    switch (type) {

      case 'joined':
        dispatch({ type: 'CONNECTED', username: payload.username, generalRoomId: payload.general_room_id })
        break

      case 'user_list':
        dispatch({ type: 'SET_USERS', users: payload })
        break

      case 'room_list':
        dispatch({ type: 'SET_ROOMS', rooms: payload })
        break

      case 'message': {
        const msg = payload
        // Determine chatKey
        let chatKey
        if (msg.msg_type === 'system') {
          chatKey = roomKey(msg.room_id)
        } else if (msg.room_id) {
          chatKey = roomKey(msg.room_id)
        } else {
          // DM — key is between sender and target
          const other = msg.sender === s.username ? msg.target_user : msg.sender
          chatKey = dmKey(s.username, other)
        }
        dispatch({ type: 'ADD_MESSAGE', chatKey, msg })

        // Notify if not the active chat and not our own message
        if (msg.sender !== s.username && msg.msg_type !== 'system') {
          const activeChatId = s.activeChat?.id
          const isMsgActive = msg.room_id
            ? activeChatId === msg.room_id
            : activeChatId === msg.sender
          if (!isMsgActive) {
            const preview = msg.msg_type === 'text'
              ? msg.content.slice(0, 60)
              : `📎 ${msg.file_name || 'File'}`
            addToast('message', msg.sender, preview)
          }
        }
        break
      }

      case 'typing': {
        const { username, room_id, target_user, is_typing } = payload
        let chatKey
        if (room_id) {
          chatKey = roomKey(room_id)
        } else if (target_user) {
          chatKey = dmKey(s.username, username)
        }
        if (chatKey) dispatch({ type: 'SET_TYPING', chatKey, username, isTyping: is_typing })
        break
      }

      case 'call_offer':
        dispatch({ type: 'SET_INCOMING_CALL', call: { from: payload.from, callType: payload.call_type, offer: payload.offer } })
        addToast('call', `📞 Incoming ${payload.call_type} call`, `${payload.from} is calling you`)
        break

      case 'call_answer':
        webrtc.handleAnswer(payload.answer)
        break

      case 'call_ice':
        webrtc.addIceCandidate(payload.candidate)
        break

      case 'call_ended':
        dispatch({ type: 'CALL_ENDED' })
        webrtc.endCall()
        addToast('message', 'Call ended', `${payload.from} ended the call`)
        break

      case 'room_created':
        addToast('room', '🏠 Room created', `#${payload.name} is ready`)
        break

      case 'room_joined':
        break

      case 'error':
        dispatch({ type: 'SET_ERROR', error: payload.message })
        break

      default:
        break
    }
  }, [addToast])

  // ── Connect ───────────────────────────────────────────────────────────────
  const connect = useCallback((serverIP, username) => {
    dispatch({ type: 'CONNECTING' })
    const url = `ws://${serverIP}:8765`
    const ws  = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      send('join', { username })
    }
    ws.onmessage = e => handleMessage(e.data)
    ws.onerror   = () => dispatch({ type: 'SET_ERROR', error: `Cannot connect to ws://${serverIP}:8765` })
    ws.onclose   = () => {
      if (stateRef.current.isConnected) {
        dispatch({ type: 'DISCONNECTED', error: 'Connection lost. Please reconnect.' })
      }
    }
  }, [send, handleMessage])

  // ── Disconnect ────────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    wsRef.current?.close()
    dispatch({ type: 'DISCONNECTED' })
  }, [])

  // ── Chat actions ──────────────────────────────────────────────────────────
  const sendMessage = useCallback((content) => {
    const s = stateRef.current
    if (!s.activeChat || !content.trim()) return
    const { type, id } = s.activeChat
    send('message', {
      content: content.trim(),
      room_id:     type === 'room' ? id : null,
      target_user: type === 'dm'   ? id : null,
    })
  }, [send])

  const sendFile = useCallback((file) => {
    const s = stateRef.current
    if (!s.activeChat) return
    const reader = new FileReader()
    reader.onload = e => {
      const { type, id } = s.activeChat
      send('file', {
        file_name:   file.name,
        file_data:   e.target.result,  // includes data-URL prefix
        room_id:     type === 'room' ? id : null,
        target_user: type === 'dm'   ? id : null,
      })
    }
    reader.readAsDataURL(file)
  }, [send])

  const sendTyping = useCallback((isTyping) => {
    const s = stateRef.current
    if (!s.activeChat) return
    const { type, id } = s.activeChat
    send('typing', {
      is_typing:   isTyping,
      room_id:     type === 'room' ? id : null,
      target_user: type === 'dm'   ? id : null,
    })
  }, [send])

  const setActiveChat = useCallback((chat) => {
    const { type, id, name } = chat
    const chatKey = type === 'room' ? roomKey(id) : dmKey(stateRef.current.username, id)
    dispatch({ type: 'SET_ACTIVE_CHAT', chat: { type, id, name }, chatKey })
  }, [])

  // ── Room actions ──────────────────────────────────────────────────────────
  const createRoom = useCallback((name) => send('create_room', { name }), [send])
  const joinRoom   = useCallback((roomId) => send('join_room', { room_id: roomId }), [send])
  const leaveRoom  = useCallback((roomId) => send('leave_room', { room_id: roomId }), [send])

  // ── Call actions ──────────────────────────────────────────────────────────
  const startCall = useCallback(async (targetUser, callType = 'video') => {
    const s = stateRef.current
    dispatch({ type: 'SET_ACTIVE_CALL', call: { with: targetUser, callType } })

    webrtc.onIceCandidate = candidate => send('call_ice', { target: targetUser, candidate })
    webrtc.onCallEnded    = () => { dispatch({ type: 'CALL_ENDED' }); send('call_end', { target: targetUser }) }
    webrtc.onRemoteStream = stream => {
      const vid = document.getElementById('remote-video')
      if (vid) vid.srcObject = stream
      addToast('message', '🎙️ Audio Connected', `You are now talking to ${targetUser}`)
    }

    await webrtc.startCall(callType)
    const offer = await webrtc.createOffer()
    send('call_offer', { target: targetUser, offer, call_type: callType })
  }, [send])

  const acceptCall = useCallback(async () => {
    const s = stateRef.current
    if (!s.incomingCall) return
    const { from, callType, offer } = s.incomingCall

    dispatch({ type: 'SET_ACTIVE_CALL', call: { with: from, callType } })

    webrtc.onIceCandidate = candidate => send('call_ice', { target: from, candidate })
    webrtc.onCallEnded    = () => { dispatch({ type: 'CALL_ENDED' }); send('call_end', { target: from }) }
    webrtc.onRemoteStream = stream => {
      const vid = document.getElementById('remote-video')
      if (vid) vid.srcObject = stream
      addToast('message', '🎙️ Audio Connected', `You are now talking to ${from}`)
    }

    const { answer, localStream } = await webrtc.handleOffer(offer, callType)
    send('call_answer', { target: from, answer })

    const localVid = document.getElementById('local-video')
    if (localVid) localVid.srcObject = localStream
  }, [send])

  const declineCall = useCallback(() => {
    const s = stateRef.current
    if (s.incomingCall) send('call_end', { target: s.incomingCall.from })
    dispatch({ type: 'CALL_ENDED' })
  }, [send])

  const endCall = useCallback(() => {
    const s = stateRef.current
    const partner = s.activeCall?.with || s.incomingCall?.from
    if (partner) send('call_end', { target: partner })
    webrtc.endCall()
    dispatch({ type: 'CALL_ENDED' })
  }, [send])

  // ── Forward message ───────────────────────────────────────────────────────
  const forwardMessage = useCallback((msg, destRoomId = null, destUser = null) => {
    send('forward_message', {
      content:         msg.content,
      msg_type:        msg.msg_type,
      original_sender: msg.sender,
      file_name:       msg.file_name,
      dest_room_id:    destRoomId,
      dest_user:       destUser,
    })
  }, [send])

  // ── Remove notification ───────────────────────────────────────────────────
  const dismissNotif = useCallback((id) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', id })
  }, [])

  // ── Expose ────────────────────────────────────────────────────────────────
  const value = {
    state,
    connect,
    disconnect,
    sendMessage,
    sendFile,
    sendTyping,
    setActiveChat,
    createRoom,
    joinRoom,
    leaveRoom,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    forwardMessage,
    dismissNotif,
  }

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export const useChat = () => useContext(ChatContext)
