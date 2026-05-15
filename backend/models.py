"""
models.py — Data Models for the Chat Application
Computer Networking Project — Socket Programming

Defines the core data structures used across the server:
  - Message: a single chat message (text, image, video, file, or system)
  - User: a connected client with their WebSocket and room memberships
  - Room: a named chat room with member tracking
"""

from dataclasses import dataclass, field
from typing import Optional, Any
import time
import uuid


# ─────────────────────────────────────────────────────────────────────────────
# Helper Functions
# ─────────────────────────────────────────────────────────────────────────────

def generate_id() -> str:
    """Generate a universally unique identifier."""
    return str(uuid.uuid4())


def now() -> float:
    """Return the current Unix timestamp."""
    return time.time()


# ─────────────────────────────────────────────────────────────────────────────
# Data Classes
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class Message:
    """
    Represents a single chat message payload.

    Attributes:
        id           : Unique message identifier
        sender       : Username of the sender ('System' for system messages)
        content      : Text string, or base64-encoded data for files/media
        msg_type     : 'text' | 'image' | 'video' | 'file' | 'system'
        timestamp    : Unix timestamp of when the message was created
        room_id      : Target room ID (set for group messages)
        target_user  : Target username (set for private/DM messages)
        file_name    : Original filename (for file/image/video messages)
        file_size    : Estimated byte size of the file (for display)
        forwarded_from: Original sender's username if this was forwarded
    """
    id: str
    sender: str
    content: str
    msg_type: str
    timestamp: float
    room_id: Optional[str] = None
    target_user: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    forwarded_from: Optional[str] = None

    def to_dict(self) -> dict:
        """Serialize this message to a JSON-compatible dictionary."""
        return {
            'id': self.id,
            'sender': self.sender,
            'content': self.content,
            'msg_type': self.msg_type,
            'timestamp': self.timestamp,
            'room_id': self.room_id,
            'target_user': self.target_user,
            'file_name': self.file_name,
            'file_size': self.file_size,
            'forwarded_from': self.forwarded_from,
        }


@dataclass
class User:
    """
    Represents a connected client session.

    Attributes:
        username  : The client's chosen display name (must be unique)
        websocket : The live WebSocket connection object
        rooms     : List of room IDs this user has joined
        status    : 'online' | 'away' | 'offline'
    """
    username: str
    websocket: Any          # websockets.WebSocketServerProtocol
    rooms: list = field(default_factory=list)
    status: str = 'online'

    def to_dict(self) -> dict:
        """Serialize user info (excluding the websocket) for broadcasting."""
        return {
            'username': self.username,
            'rooms': self.rooms,
            'status': self.status,
        }


@dataclass
class Room:
    """
    Represents a named group chat room.

    Attributes:
        id         : Unique room identifier (UUID)
        name       : Display name for the room
        created_by : Username of the user who created it
        members    : List of usernames currently in this room
        created_at : Unix timestamp of room creation
    """
    id: str
    name: str
    created_by: str
    members: list = field(default_factory=list)
    created_at: float = field(default_factory=now)

    def to_dict(self) -> dict:
        """Serialize room info for broadcasting."""
        return {
            'id': self.id,
            'name': self.name,
            'created_by': self.created_by,
            'members': self.members,
            'created_at': self.created_at,
        }
