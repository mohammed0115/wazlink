"""Local development settings. The ONLY module permitted to set DEBUG True."""

from .base import *  # noqa: F403
from .base import ENVIRONMENT, env_bool

if ENVIRONMENT != "local":
    raise RuntimeError("ENVIRONMENT must be 'local' when config.settings.local is loaded (fail-closed)")

DEBUG = env_bool("DJANGO_DEBUG", True)
