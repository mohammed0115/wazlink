"""Provider translation ONLY — no business logic (B14_03 §1, §6 rule 4).

Every module under adapters/ imports the port interface it implements from
common/provider_ports.py and nothing else from the codebase. It never imports
apps/, so it can hold no business rule and no permission decision (T-ARCH-8).
"""
