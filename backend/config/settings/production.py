"""Production settings. Hardened posture; DEBUG can never be True here."""

from .base import *  # noqa: F403
from .base import ENVIRONMENT

if ENVIRONMENT not in ("production", "staging"):
    raise RuntimeError("ENVIRONMENT must be 'production' or 'staging' when a production posture is loaded")

DEBUG = False
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
