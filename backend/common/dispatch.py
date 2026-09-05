"""CommandRegistry — infrastructure dispatch BY NAME (B14_03 §6 rule 13).

platform_async holds a command NAME and a reference payload. It never imports
apps.<domain>.services. Registration happens ONLY in config/.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any


class UnknownCommandError(LookupError):
    """A name that is not registered is REFUSED. There is no 'dispatch anything' path."""


class CommandRegistry:
    def __init__(self) -> None:
        self._commands: dict[str, Callable[..., Any]] = {}

    def register(self, name: str, handler: Callable[..., Any]) -> None:
        self._commands[name] = handler

    def dispatch(self, name: str, payload: dict[str, Any]) -> Any:
        handler = self._commands.get(name)
        if handler is None:
            raise UnknownCommandError(name)
        return handler(**payload)

    def is_registered(self, name: str) -> bool:
        return name in self._commands

    def clear(self) -> None:
        self._commands.clear()


command_registry = CommandRegistry()
