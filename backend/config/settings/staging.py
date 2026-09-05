"""Staging inherits the PRODUCTION posture with staging values (B14_29 §5),
so a production-hardening setting cannot be present in production and absent
in staging.
"""

from .production import *  # noqa: F403
