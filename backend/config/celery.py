"""Celery application — the FIVE frozen queues only, no sixth (B14_09 §1)."""

from __future__ import annotations

import os

from celery import Celery
from kombu import Queue

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")

app = Celery("wazlink")
app.config_from_object("django.conf:settings", namespace="CELERY")

FROZEN_QUEUES = ("default", "providers.fast", "providers.slow", "webhooks", "maintenance")

app.conf.task_queues = tuple(Queue(name) for name in FROZEN_QUEUES)
app.conf.task_default_queue = "default"
app.autodiscover_tasks()
