"""Test settings. DEBUG stays False; browser-origin validation still runs."""

from .base import *  # noqa: F403
from .base import ENVIRONMENT

if ENVIRONMENT not in ("test", "local"):
    raise RuntimeError("ENVIRONMENT must be 'test' when config.settings.test is loaded (fail-closed)")

DEBUG = False
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]  # test speed only

# Deterministic fake adapters behind the REAL ports (B14_19, LSP). No test
# reaches a provider network, and no domain module knows the difference.
USE_STUB_PROVIDERS = True

# Celery is not running in tests. A task is exercised by calling the worker
# entry point directly — the SAME code path a real worker takes — rather than
# by faking the work it performs.
CELERY_TASK_ALWAYS_EAGER = False
TASK_EXECUTION = "recorded"
