import React, { useContext } from 'react'
import { ChatContext } from './context/ChatContext.jsx'
import Login from './components/Login.jsx'
import Sidebar from './components/Sidebar.jsx'
import ChatWindow from './components/ChatWindow.jsx'
import CallModal from './components/CallModal.jsx'
import NotificationToast from './components/NotificationToast.jsx'

export default function App() {
  const { state } = useContext(ChatContext)

  if (!state.isConnected) {
    return <Login />
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <ChatWindow />
      {(state.incomingCall || state.activeCall) && <CallModal />}
      <NotificationToast />
    </div>
  )
}
