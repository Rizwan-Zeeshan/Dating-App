"""
file_handler.py — File Transfer Message Builder
Computer Networking Project — Socket Programming

Files (images, videos, documents) are transmitted as base64-encoded strings
embedded inside the standard WebSocket JSON message envelope.

This module categorises a file by its extension and builds the correct
message payload so the React frontend knows how to render it.
"""

import time
import uuid
import logging

logger = logging.getLogger('FileHandler')

# ─────────────────────────────────────────────────────────────────────────────
# Extension Sets
# ─────────────────────────────────────────────────────────────────────────────

IMAGE_EXTS = {'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'}
VIDEO_EXTS = {'mp4', 'webm', 'mov', 'avi', 'mkv', 'ogv', 'flv', 'm4v'}


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def get_file_type(filename: str) -> str:
    """
    Determine the message type based on the file extension.

    Returns:
        'image'  — for common image formats (jpg/png/gif/webp …)
        'video'  — for common video formats (mp4/webm/mov …)
        'file'   — for everything else (pdf/zip/docx …)
    """
    if '.' not in filename:
        return 'file'
    ext = filename.rsplit('.', 1)[-1].lower()
    if ext in IMAGE_EXTS:
        return 'image'
    if ext in VIDEO_EXTS:
        return 'video'
    return 'file'


def estimate_size(b64_data: str) -> int:
    """
    Estimate the decoded byte size of a base64 string.
    Strips a data-URL prefix ("data:...;base64,") if present.
    """
    if ',' in b64_data:
        b64_data = b64_data.split(',', 1)[1]
    padding = b64_data.count('=')
    return max(0, (len(b64_data) * 3 // 4) - padding)


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def build_file_message(
    sender: str,
    filename: str,
    file_data: str,          # Full base64 string (may include data-URL prefix)
    room_id: str = None,
    target_user: str = None,
) -> dict:
    """
    Construct a complete WebSocket message envelope for a file transfer.

    The frontend uses the returned dict directly after JSON-serialisation.

    Args:
        sender      : Username of the uploading client
        filename    : Original file name including extension
        file_data   : Base64-encoded file content (with or without data-URL prefix)
        room_id     : Destination room ID  (group file share)
        target_user : Destination username  (private DM file share)

    Returns:
        dict — ready to be passed to ChatManager.broadcast_room() or send_private()
    """
    msg_type = get_file_type(filename)
    size_bytes = estimate_size(file_data)

    destination = f"room:{room_id}" if room_id else f"dm:{target_user}"
    logger.info(
        f"File transfer | {sender} → {destination} | "
        f"{filename} ({msg_type}, ~{size_bytes // 1024} KB)"
    )

    return {
        'type': 'message',
        'payload': {
            'id': str(uuid.uuid4()),
            'sender': sender,
            'content': file_data,        # base64 string (includes data-URL prefix)
            'msg_type': msg_type,
            'timestamp': time.time(),
            'room_id': room_id,
            'target_user': target_user,
            'file_name': filename,
            'file_size': size_bytes,
            'forwarded_from': None,
        },
    }
