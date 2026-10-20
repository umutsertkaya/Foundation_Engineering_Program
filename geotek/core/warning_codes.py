"""Translatable warning strings inside the plain ``list[str]`` warning contract."""

from __future__ import annotations

import json


def format_warning(code: str, **params) -> str:
    """Format ``<code>: key=value ...`` within the existing list[str] contract.

    Code is the full i18n lookup key; without parameters return just that key.
    Keys are identifiers, values are compact JSON (including quoted strings,
    arrays, objects, booleans and null), separated by one space in insertion
    order. Depths are SI metres. Use parse_warning, not whitespace splitting:
    JSON strings may contain spaces, colons, equals signs or escaped quotes.
    """
    if not code or ":" in code or any(c.isspace() for c in code):
        raise ValueError("Warning code must be a nonempty key without spaces or colons")
    if any(not key.isidentifier() for key in params):
        raise ValueError("Warning parameter keys must be identifiers")
    context = " ".join(
        f"{key}={json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(',', ':'))}"
        for key, value in params.items()
    )
    return f"{code}: {context}" if context else code


def parse_warning(message: str) -> tuple[str, dict]:
    """Return the i18n code and JSON-decoded parameters; reject malformed context."""
    code, separator, context = message.partition(":")
    format_warning(code)  # Apply the same code validation to both directions.
    params = {}
    if separator:
        if not context.startswith(" ") or not context.strip():
            raise ValueError("Warning context must contain key=value parameters")
        remaining = context[1:]
        decoder = json.JSONDecoder()
        while remaining:
            key, equals, value = remaining.partition("=")
            if not equals or not key.isidentifier() or key in params:
                raise ValueError("Invalid or duplicate warning parameter key")
            params[key], end = decoder.raw_decode(value)
            remaining = value[end:]
            if remaining:
                if not remaining.startswith(" ") or not remaining[1:]:
                    raise ValueError("Warning parameters must be separated by spaces")
                remaining = remaining[1:]
    return code, params
