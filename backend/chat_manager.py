"""
chat_manager.py — Core Chat Business Logic
Computer Networking Project — Socket Programming

The ChatManager class is the central hub for all server-side chat operations:
  - Registering / removing users on connect / disconnect
  - Creating, joining, and leaving chat rooms
  - Routing messages (broadcast to room OR send to specific user)
  - Pushing live user-list and room-list updates to every client

Uses asyncio.Lock to ensure thread-safe mutations of shared state.
"""

import asyncio
import json
import logging
import time
import uuid

from models import User, Room

logger = logging.getLogger('ChatManager')


class ChatManager:
    """
    Manages server-side state and message routing for all connected clients.
    All public methods are async and safe to call from concurrent client handlers.
    """

    def __init__(self):
        # Active users keyed by username
        self.users: dict[str, User] = {}

        # All chat rooms keyed by room_id
        self.rooms: dict[str, Room] = {}

        # Async lock — prevents race conditions on shared dicts
        self._lock = asyncio.Lock()

        # Bootstrap: create the always-present "General" room
        gid = str(uuid.uuid4())
        self.general_room_id: str = gid
        self.rooms[gid] = Room(
            id=gid,
            name='General',
            created_by='System',
        )
        logger.info(f"General room created  id={gid}")

    # ─────────────────────────────────────────────────────────────────────────
    # User Lifecycle
    # ─────────────────────────────────────────────────────────────────────────

    async def add_user(self, username: str, websocket) -> None:
        """
        Register a new client.
        Automatically adds them to the General room, then broadcasts
        the updated user-list and room-list to every connected client.
        """
        async with self._lock:
            user = User(username=username, websocket=websocket, rooms=[self.general_room_id])
            self.users[username] = user
            self.rooms[self.general_room_id].members.append(username)

        logger.info(f"[+] '{username}' connected  (online: {len(self.users)})")
        await self.broadcast_user_list()
        await self.broadcast_room_list()
        await self._system_msg(self.general_room_id, f"👋 {username} joined the chat!")

    async def remove_user(self, username: str) -> None:
        """
        De-register a client after disconnect.
        Removes them from every room they were in, then notifies everyone.
        """
        async with self._lock:
            if username not in self.users:
                return
            user = self.users.pop(username)
            for rid in list(user.rooms):
                if rid in self.rooms and username in self.rooms[rid].members:
                    self.rooms[rid].members.remove(username)

        logger.info(f"[-] '{username}' disconnected  (online: {len(self.users)})")
        await self.broadcast_user_list()
        await self.broadcast_room_list()
        await self._system_msg(self.general_room_id, f"🚪 {username} left the chat.")

    # ─────────────────────────────────────────────────────────────────────────
    # Room Management
    # ─────────────────────────────────────────────────────────────────────────

    async def create_room(self, name: str, created_by: str) -> str:
        """
        Create a new group room. The creator is the first member.
        Returns the new room's ID.
        """
        rid = str(uuid.uuid4())
        room = Room(id=rid, name=name, created_by=created_by, members=[created_by])
        async with self._lock:
            self.rooms[rid] = room
            if created_by in self.users and rid not in self.users[created_by].rooms:
                self.users[created_by].rooms.append(rid)

        logger.info(f"[R] Room '{name}' created by '{created_by}'")
        await self.broadcast_room_list()
        return rid

    async def join_room(self, username: str, room_id: str) -> bool:
        """
        Add a user to an existing room.
        Returns True on success, False if the room or user doesn't exist.
        """
        async with self._lock:
            if room_id not in self.rooms or username not in self.users:
                return False
            if username not in self.rooms[room_id].members:
                self.rooms[room_id].members.append(username)
            if room_id not in self.users[username].rooms:
                self.users[username].rooms.append(room_id)

        room_name = self.rooms[room_id].name
        logger.info(f"[R] '{username}' joined room '{room_name}'")
        await self.broadcast_room_list()
        await self._system_msg(room_id, f"👤 {username} joined #{room_name}")
        return True

    async def leave_room(self, username: str, room_id: str) -> None:
        """
        Remove a user from a room.
        The General room cannot be left.
        """
        if room_id == self.general_room_id:
            return
        async with self._lock:
            if room_id not in self.rooms or username not in self.users:
                return
            if username in self.rooms[room_id].members:
                self.rooms[room_id].members.remove(username)
            if room_id in self.users[username].rooms:
                self.users[username].rooms.remove(room_id)

        room_name = self.rooms[room_id].name
        await self.broadcast_room_list()
        await self._system_msg(room_id, f"🚶 {username} left #{room_name}")

    # ─────────────────────────────────────────────────────────────────────────
    # Message Routing
    # ─────────────────────────────────────────────────────────────────────────

    async def broadcast_room(self, room_id: str, message: dict, exclude: str = None) -> None:
        """
        Deliver a message to every member currently in the specified room.
        Optionally exclude one user (e.g., the sender already has the message).
        """
        if room_id not in self.rooms:
            logger.warning(f"broadcast_room: room {room_id} not found")
            return
        for uname in list(self.rooms[room_id].members):
            if uname != exclude:
                await self.send_to_user(uname, message)

    async def send_private(self, sender: str, target: str, message: dict) -> None:
        """
        Route a private / DM message.
        Delivers to both the target AND the sender (echo for sender's own chat history).
        """
        await self.send_to_user(target, message)
        if sender != target:
            await self.send_to_user(sender, message)

    async def send_to_user(self, username: str, message: dict) -> None:
        """
        Send a single message to one specific user.
        Silently ignores if the user is no longer connected.
        """
        if username in self.users:
            try:
                await self.users[username].websocket.send(json.dumps(message))
            except Exception as exc:
                logger.error(f"send_to_user '{username}': {exc}")

    # ─────────────────────────────────────────────────────────────────────────
    # State Broadcasts
    # ─────────────────────────────────────────────────────────────────────────

    async def broadcast_user_list(self) -> None:
        """Push the latest connected-user list to every client."""
        payload = [u.to_dict() for u in self.users.values()]
        await self._broadcast_all({'type': 'user_list', 'payload': payload})

    async def broadcast_room_list(self) -> None:
        """Push the latest room list to every client."""
        payload = [r.to_dict() for r in self.rooms.values()]
        await self._broadcast_all({'type': 'room_list', 'payload': payload})

    async def _broadcast_all(self, message: dict) -> None:
        """Send a message to every currently connected user."""
        for uname, user in list(self.users.items()):
            try:
                await user.websocket.send(json.dumps(message))
            except Exception as exc:
                logger.error(f"_broadcast_all to '{uname}': {exc}")

    async def _system_msg(self, room_id: str, text: str) -> None:
        """Post an in-room system notification (join / leave / etc.)."""
        msg = {
            'type': 'message',
            'payload': {
                'id': str(uuid.uuid4()),
                'sender': 'System',
                'content': text,
                'msg_type': 'system',
                'timestamp': time.time(),
                'room_id': room_id,
                'target_user': None,
                'file_name': None,
                'file_size': None,
                'forwarded_from': None,
            },
        }
        await self.broadcast_room(room_id, msg)
