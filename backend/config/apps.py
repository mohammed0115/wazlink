"""AppConfig for the composition root — populates the registries at ready time."""

from django.apps import AppConfig


class CompositionRootConfig(AppConfig):
    name = "config"
    label = "config"
    verbose_name = "Composition root"

    def ready(self) -> None:
        from .registry import register_all

        register_all()
