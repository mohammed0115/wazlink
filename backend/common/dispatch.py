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


class TaskRegistry:
    """Async work enqueued BY REGISTERED NAME (B14_09 §5).

    "Celery tasks are routed the same way" as commands: a caller holds a task
    name and a reference payload, never an import of another app's `tasks.py`.
    That is what keeps a domain free to schedule work without acquiring a class
    A edge to the module that performs it.

    The registry also makes enqueueing OBSERVABLE. A test can assert that a
    command scheduled the right work with the right durable reference, and then
    run the worker entry point itself — which is how a redelivery is exercised
    honestly instead of being assumed.
    """

    def __init__(self) -> None:
        self._senders: dict[str, Callable[..., Any]] = {}
        self.enqueued: list[tuple[str, dict[str, Any]]] = []

    def register(self, name: str, sender: Callable[..., Any]) -> None:
        self._senders[name] = sender

    def enqueue(self, name: str, **payload: Any) -> Any:
        sender = self._senders.get(name)
        if sender is None:
            raise UnknownCommandError(name)
        self.enqueued.append((name, dict(payload)))
        return sender(**payload)

    def is_registered(self, name: str) -> bool:
        return name in self._senders

    def clear(self) -> None:
        self._senders.clear()
        self.enqueued.clear()


command_registry = CommandRegistry()
task_registry = TaskRegistry()
