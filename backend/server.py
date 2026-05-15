"""
server.py — Main WebSocket Chat Server
Computer Networking Project — Socket Programming

Entry point for the Python chat server.
Uses the `websockets` library (built on asyncio + TCP sockets) to handle
multiple clients concurrently without traditional threading.

Each connected client runs in its own async coroutine (`handle_client`),
which is automatically scheduled by the asyncio event loop, providing
efficient concurrency without the overhead of OS threads.

Run this file to start the server:
    python server.py

Clients connect via:
    ws://<SERVER_LAN_IP>:8765
"""

import asyncio
import json
import logging
import time
import uuid

import websockets
# WebSocketServerProtocol removed in websockets 14+ — type hint uses Any

from chat_manager import ChatManager
from file_handler import build_file_message
from signaling import CallManager

# ─────────────────────────────────────────────────────────────────────────────
# Logging Configuration
# ─────────────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s  %(levelname)-8s  %(name)s — %(message)s',
    datefmt='%H:%M:%S',
)
logger = logging.getLogger('Server')

# ─────────────────────────────────────────────────────────────────────────────
# Server Configuration
# ─────────────────────────────────────────────────────────────────────────────
HOST = '0.0.0.0'   # Bind to all network interfaces → accessible over LAN/Wi-Fi
PORT = 8765        # WebSocket port

# ─────────────────────────────────────────────────────────────────────────────
# Global Managers (shared across all client handlers)
# ─────────────────────────────────────────────────────────────────────────────
chat  = ChatManager()
calls = CallManager()


# ─────────────────────────────────────────────────────────────────────────────
# Client Handler
# ─────────────────────────────────────────────────────────────────────────────

async def handle_client(websocket, path: str = '/'):
    """
    Per-client coroutine — runs for the lifetime of each WebSocket connection.

    Message flow:
        1. Client sends { "type": "join",    "payload": { "username": "..." } }
        2. Client sends { "type": "message", "payload": { ... } }
        3. Client sends { "type": "file",    "payload": { ... } }
        ... (see protocol table in README)
        N. Connection closes → user is removed and everyone is notified.
    """
    username: str | None = None
    addr = websocket.remote_address
    logger.info(f"Connection from {addr}")

    try:
        async for raw in websocket:
            try:
                data    = json.loads(raw)
                mtype   = data.get('type', '')
                payload = data.get('payload', {})

                # ── JOIN ────────────────────────────────────────────────────
                if mtype == 'join':
                    name = payload.get('username', '').strip()
                    if not name:
                        await websocket.send(_err('Username cannot be empty.'))
                        continue
                    if name in chat.users:
                        await websocket.send(_err(f"'{name}' is already taken. Choose another."))
                        continue

                    username = name
                    await chat.add_user(username, websocket)

                    # Confirm login + send initial server state
                    await websocket.send(json.dumps({
                        'type': 'joined',
                        'payload': {
                            'username': username,
                            'general_room_id': chat.general_room_id,
                        },
                    }))
                    logger.info(f"'{username}' joined from {addr}")

                # ── TEXT MESSAGE ─────────────────────────────────────────────
                elif mtype == 'message' and username:
                    msg = _make_msg(
                        sender=username,
                        content=payload.get('content', ''),
                        msg_type='text',
                        room_id=payload.get('room_id'),
                        target_user=payload.get('target_user'),
                    )
                    if payload.get('room_id'):
                        await chat.broadcast_room(payload['room_id'], msg)
                    elif payload.get('target_user'):
                        await chat.send_private(username, payload['target_user'], msg)

                # ── FILE / IMAGE / VIDEO ─────────────────────────────────────
                elif mtype == 'file' and username:
                    msg = build_file_message(
                        sender=username,
                        filename=payload.get('file_name', 'file'),
                        file_data=payload.get('file_data', ''),
                        room_id=payload.get('room_id'),
                        target_user=payload.get('target_user'),
                    )
                    if payload.get('room_id'):
                        await chat.broadcast_room(payload['room_id'], msg)
                    elif payload.get('target_user'):
                        await chat.send_private(username, payload['target_user'], msg)

                # ── CREATE ROOM ──────────────────────────────────────────────
                elif mtype == 'create_room' and username:
                    name = payload.get('name', '').strip()
                    if name:
                        rid = await chat.create_room(name, username)
                        await websocket.send(json.dumps({
                            'type': 'room_created',
                            'payload': {'room_id': rid, 'name': name},
                        }))

                # ── JOIN ROOM ────────────────────────────────────────────────
                elif mtype == 'join_room' and username:
                    rid = payload.get('room_id')
                    if rid:
                        ok = await chat.join_room(username, rid)
                        await websocket.send(json.dumps({
                            'type': 'room_joined',
                            'payload': {'room_id': rid, 'success': ok},
                        }))

                # ── LEAVE ROOM ───────────────────────────────────────────────
                elif mtype == 'leave_room' and username:
                    rid = payload.get('room_id')
                    if rid:
                        await chat.leave_room(username, rid)

                # ── TYPING INDICATOR ─────────────────────────────────────────
                elif mtype == 'typing' and username:
                    typing_msg = {
                        'type': 'typing',
                        'payload': {
                            'username': username,
                            'room_id': payload.get('room_id'),
                            'target_user': payload.get('target_user'),
                            'is_typing': payload.get('is_typing', False),
                        },
                    }
                    if payload.get('room_id'):
                        await chat.broadcast_room(payload['room_id'], typing_msg, exclude=username)
                    elif payload.get('target_user'):
                        await chat.send_to_user(payload['target_user'], typing_msg)

                # ── WEBRTC — CALL OFFER ──────────────────────────────────────
                elif mtype == 'call_offer' and username:
                    target    = payload.get('target')
                    offer     = payload.get('offer')
                    call_type = payload.get('call_type', 'video')
                    if target and offer:
                        calls.initiate(username, target)
                        await chat.send_to_user(target, {
                            'type': 'call_offer',
                            'payload': {'from': username, 'offer': offer, 'call_type': call_type},
                        })
                        logger.info(f"Call offer: {username} → {target} [{call_type}]")

                # ── WEBRTC — CALL ANSWER ─────────────────────────────────────
                elif mtype == 'call_answer' and username:
                    target = payload.get('target')
                    answer = payload.get('answer')
                    if target and answer:
                        logger.info(f"Call answer: {username} → {target}")
                        await chat.send_to_user(target, {
                            'type': 'call_answer',
                            'payload': {'from': username, 'answer': answer},
                        })

                # ── WEBRTC — ICE CANDIDATE ───────────────────────────────────
                elif mtype == 'call_ice' and username:
                    target    = payload.get('target')
                    candidate = payload.get('candidate')
                    if target and candidate:
                        # Log ICE sparingly as there are many
                        await chat.send_to_user(target, {
                            'type': 'call_ice',
                            'payload': {'from': username, 'candidate': candidate},
                        })

                # ── WEBRTC — END CALL ────────────────────────────────────────
                elif mtype == 'call_end' and username:
                    partner = calls.end(username) or payload.get('target')
                    if partner:
                        await chat.send_to_user(partner, {
                            'type': 'call_ended',
                            'payload': {'from': username},
                        })

                # ── FORWARD MESSAGE ──────────────────────────────────────────
                elif mtype == 'forward_message' and username:
                    dest_room = payload.get('dest_room_id')
                    dest_user = payload.get('dest_user')
                    msg = _make_msg(
                        sender=username,
                        content=payload.get('content', ''),
                        msg_type=payload.get('msg_type', 'text'),
                        room_id=dest_room,
                        target_user=dest_user,
                        file_name=payload.get('file_name'),
                        forwarded_from=payload.get('original_sender', username),
                    )
                    if dest_room:
                        await chat.broadcast_room(dest_room, msg)
                    elif dest_user:
                        await chat.send_private(username, dest_user, msg)

                # ── PING / KEEPALIVE ─────────────────────────────────────────
                elif mtype == 'ping':
                    await websocket.send(json.dumps({'type': 'pong'}))

            except json.JSONDecodeError:
                logger.warning(f"Invalid JSON from {addr}")
            except Exception as exc:
                logger.error(f"Handler error ({addr}): {exc}", exc_info=True)

    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        if username:
            # End any active call this user was in
            partner = calls.end(username)
            if partner:
                await chat.send_to_user(partner, {
                    'type': 'call_ended',
                    'payload': {'from': username},
                })
            await chat.remove_user(username)
        logger.info(f"Connection closed for {addr} / user='{username}'")


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _make_msg(
    sender: str,
    content: str,
    msg_type: str = 'text',
    room_id=None,
    target_user=None,
    file_name=None,
    file_size=None,
    forwarded_from=None,
) -> dict:
    """Build a standard message envelope."""
    return {
        'type': 'message',
        'payload': {
            'id': str(uuid.uuid4()),
            'sender': sender,
            'content': content,
            'msg_type': msg_type,
            'timestamp': time.time(),
            'room_id': room_id,
            'target_user': target_user,
            'file_name': file_name,
            'file_size': file_size,
            'forwarded_from': forwarded_from,
        },
    }


def _err(message: str) -> str:
    """Build a JSON-encoded error message string."""
    return json.dumps({'type': 'error', 'payload': {'message': message}})


# ─────────────────────────────────────────────────────────────────────────────
# Entry Point
# ─────────────────────────────────────────────────────────────────────────────

async def main():
    import socket as _socket
    # Resolve LAN IP for display purposes
    try:
        s = _socket.socket(_socket.AF_INET, _socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        lan_ip = s.getsockname()[0]
        s.close()
    except Exception:
        lan_ip = '(could not detect LAN IP)'

    print()
    print('=' * 60)
    print('  [*]  ChatSpace Server')
    print(f'  [>]  Listening on  ws://0.0.0.0:{PORT}')
    print(f'  [LAN] clients  ws://{lan_ip}:{PORT}')
    print('  Press Ctrl+C to stop.')
    print('=' * 60)
    print()

    async with websockets.serve(
        handle_client,
        HOST,
        PORT,
        max_size=50 * 1024 * 1024,   # 50 MB — supports large file transfers
        ping_interval=30,             # Keep-alive pings every 30 s
        ping_timeout=10,
    ):
        await asyncio.Future()        # Run indefinitely


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print('\n🛑  Server stopped.')
