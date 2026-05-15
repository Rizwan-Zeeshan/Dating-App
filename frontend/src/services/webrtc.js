/**
 * webrtc.js — WebRTC Service
 * Manages the RTCPeerConnection lifecycle for voice and video calls.
 * The Python server handles signaling; actual media flows P2P between browsers.
 */

// STUN servers for ICE negotiation (works on LAN without TURN)
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

class WebRTCService {
  constructor() {
    this.pc = null            // RTCPeerConnection
    this.localStream = null   // MediaStream from getUserMedia
    this.remoteStream = null  // Incoming stream from peer

    // Callbacks set by the caller
    this.onRemoteStream = null   // (stream) => void
    this.onIceCandidate = null   // (candidate) => void
    this.onCallEnded = null      // () => void
  }

  /**
   * Start a call — get local media and create RTCPeerConnection.
   * @param {string} callType - 'video' | 'audio'
   * @returns {MediaStream} local stream for preview
   */
  async startCall(callType = 'video') {
    const constraints = {
      audio: true,
      video: callType === 'video' ? { width: 1280, height: 720 } : false,
    }

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints)
    } catch (err) {
      console.error('[WebRTC] getUserMedia failed:', err)
      // Fallback: try audio-only
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    }

    this._createPeerConnection()
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => this.pc.addTrack(track, this.localStream))
    }
    return this.localStream
  }

  /**
   * Create an SDP offer to send to the remote peer.
   * @returns {RTCSessionDescriptionInit} offer
   */
  async createOffer() {
    const offer = await this.pc.createOffer()
    await this.pc.setLocalDescription(offer)
    return offer
  }

  /**
   * Handle an incoming SDP offer — set remote description and create answer.
   * @param {RTCSessionDescriptionInit} offer
   * @param {string} callType
   * @returns {RTCSessionDescriptionInit} answer
   */
  async handleOffer(offer, callType = 'video') {
    await this.startCall(callType)
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer))
    const answer = await this.pc.createAnswer()
    await this.pc.setLocalDescription(answer)
    return { answer, localStream: this.localStream }
  }

  /**
   * Handle an incoming SDP answer from the remote peer.
   * @param {RTCSessionDescriptionInit} answer
   */
  async handleAnswer(answer) {
    if (this.pc && this.pc.signalingState !== 'stable') {
      await this.pc.setRemoteDescription(new RTCSessionDescription(answer))
    }
  }

  /**
   * Add an ICE candidate received from the signaling server.
   * @param {RTCIceCandidateInit} candidate
   */
  async addIceCandidate(candidate) {
    if (this.pc) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate))
      } catch (err) {
        console.error('[WebRTC] addIceCandidate error:', err)
      }
    }
  }

  /** Toggle the local audio track mute state. */
  toggleMute() {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
      return !this.localStream.getAudioTracks()[0]?.enabled
    }
    return false
  }

  /** Toggle the local video track on/off. */
  toggleCamera() {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(t => { t.enabled = !t.enabled })
      return !this.localStream.getVideoTracks()[0]?.enabled
    }
    return false
  }

  /** Clean up — stop all tracks and close the peer connection. */
  endCall() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop())
      this.localStream = null
    }
    if (this.pc) {
      this.pc.close()
      this.pc = null
    }
    this.remoteStream = null
  }

  // ── Private ──────────────────────────────────────────────────────────────

  _createPeerConnection() {
    this.pc = new RTCPeerConnection(RTC_CONFIG)

    // Send ICE candidates through the signaling server
    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate && this.onIceCandidate) {
        this.onIceCandidate(candidate)
      }
    }

    // Receive remote media stream
    this.pc.ontrack = ({ streams }) => {
      const [stream] = streams
      this.remoteStream = stream
      if (this.onRemoteStream) this.onRemoteStream(stream)
    }

    this.pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(this.pc?.connectionState)) {
        if (this.onCallEnded) this.onCallEnded()
      }
    }
  }
}

// Singleton instance shared across the app
export const webrtc = new WebRTCService()
