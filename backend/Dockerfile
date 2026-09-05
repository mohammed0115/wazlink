# WazLink backend — B14_30 §3. Multi-stage; the runtime stage copies the
# virtualenv only, and the process user is NON-ROOT.
FROM python:3.13-slim AS builder

ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app
COPY pyproject.toml uv.lock ./
# --frozen fails the build if the lock is stale, exactly as the frontend's
# pnpm --frozen-lockfile does.
RUN uv sync --frozen --no-dev --no-install-project

FROM python:3.13-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH"

# Explicit non-root UID.
RUN groupadd --gid 10001 wazlink \
 && useradd --uid 10001 --gid 10001 --create-home --shell /usr/sbin/nologin wazlink

WORKDIR /app
COPY --from=builder --chown=10001:10001 /app/.venv /app/.venv
COPY --chown=10001:10001 . /app

USER 10001

EXPOSE 8000

# Three distinct commands off ONE image (web / worker / beat). The worker
# subscribes by explicit -Q to the five frozen queues only; there is no sixth.
CMD ["gunicorn", "config.wsgi:application", \
     "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "60"]
