"""Local AI Audit Analytics Assistant.

Flow: authenticated user -> server-side scope (scope.py) -> validated request -> registered
deterministic analytics function (analytics.py) -> verified result -> optional local-model
narration (narration.py via ollama.py) -> draft report (reports.py).

The language model never reads the database, never decides permissions and never changes data.
"""
