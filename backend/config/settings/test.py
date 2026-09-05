"""Test settings. DEBUG stays False; browser-origin validation still runs."""

from .base import *  # noqa: F403
from .base import ENVIRONMENT

if ENVIRONMENT not in ("test", "local"):
    raise RuntimeError("ENVIRONMENT must be 'test' when config.settings.test is loaded (fail-closed)")

DEBUG = False
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]  # test speed only
