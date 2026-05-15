"""
signaling.py — WebRTC Signaling State Manager
Computer Networking Project — Socket Programming

The Python server acts as a **signaling relay** for WebRTC calls:
 - It does NOT process any audio/video data.
 - It simply forwards SDP offers, SDP answers, and ICE candidates
   between peers until they establish a direct P2P media channel.

The CallManager here tracks who is in a call with whom so the server
can clean up state when a user disconnects mid-call.
"""

import logging
from typing import Optional

logger = logging.getLogger('CallManager')


class CallManager:
    """
    Tracks active WebRTC calls by mapping each participant to their partner.

    Since every call involves exactly two parties, an active call is stored
    as two symmetric entries:
        caller  → callee
        callee  → caller
    """

    def __init__(self):
        # Maps username → call partner username
        self._calls: dict[str, str] = {}

    # ─────────────────────────────────────────────────────────────────────────
    # Call Lifecycle
    # ─────────────────────────────────────────────────────────────────────────

    def initiate(self, caller: str, callee: str) -> None:
        """Record that caller has offered a call to callee."""
        self._calls[caller] = callee
        self._calls[callee] = caller
        logger.info(f"📞 Call initiated: {caller} ↔ {callee}")

    def end(self, user: str) -> Optional[str]:
        """
        Teardown a call involving 'user'.

        Returns:
            The other party's username if there was an active call,
            otherwise None.
        """
        partner = self._calls.pop(user, None)
        if partner:
            self._calls.pop(partner, None)
            logger.info(f"📵 Call ended: {user} ↔ {partner}")
        return partner

    # ─────────────────────────────────────────────────────────────────────────
    # Query Methods
    # ─────────────────────────────────────────────────────────────────────────

    def partner_of(self, user: str) -> Optional[str]:
        """Return the call partner of 'user', or None if not in a call."""
        return self._calls.get(user)

    def in_call(self, user: str) -> bool:
        """Return True if 'user' is currently in an active call."""
        return user in self._calls

    @property
    def active_count(self) -> int:
        """Number of currently active calls (each call counted once)."""
        return len(self._calls) // 2
