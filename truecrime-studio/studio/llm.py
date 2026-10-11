"""Thin helpers around the Anthropic SDK shared by the research and script steps."""
from __future__ import annotations

import anthropic

# Server-side refusal fallback: if the main model declines (true crime material can
# trip safety classifiers), the API re-runs the request on a suitable fallback model.
FALLBACK_HEADERS = {"anthropic-beta": "server-side-fallback-2026-07-01"}
FALLBACK_BODY = {"fallbacks": "default"}

_client: anthropic.Anthropic | None = None


def client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic()
    return _client


class Refused(RuntimeError):
    pass


def check_stop(message) -> None:
    if message.stop_reason == "refusal":
        details = getattr(message, "stop_details", None)
        why = getattr(details, "explanation", None) or "no explanation given"
        raise Refused(f"The model declined this request ({why}).")
    if message.stop_reason == "max_tokens":
        raise RuntimeError("Response was cut off at max_tokens; try a lower target length.")


def text_of(message) -> str:
    return "".join(b.text for b in message.content if b.type == "text")
