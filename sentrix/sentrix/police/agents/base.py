"""Base LLM agent for police: API-based (OpenAI/Anthropic), JSON extraction."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from sentrix.police.config import (
    POLICE_ANTHROPIC_API_KEY,
    POLICE_DEPLOYMENT,
    POLICE_MAX_TOKENS,
    POLICE_MODEL_ANTHROPIC,
    POLICE_MODEL_OPENAI,
    POLICE_OPENAI_API_KEY,
    POLICE_TEMPERATURE,
)

logger = logging.getLogger(__name__)


def _make_llm():
    """Build ChatOpenAI or ChatAnthropic from config."""
    if POLICE_DEPLOYMENT == "anthropic" and POLICE_ANTHROPIC_API_KEY:
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(
            api_key=POLICE_ANTHROPIC_API_KEY,
            model=POLICE_MODEL_ANTHROPIC,
            temperature=POLICE_TEMPERATURE,
            max_tokens=POLICE_MAX_TOKENS,
        )
    if POLICE_OPENAI_API_KEY:
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            api_key=POLICE_OPENAI_API_KEY,
            model=POLICE_MODEL_OPENAI,
            temperature=POLICE_TEMPERATURE,
            max_tokens=POLICE_MAX_TOKENS,
        )
    raise RuntimeError("Police requires OPENAI_API_KEY or ANTHROPIC_API_KEY (or POLICE_* env vars)")


def _extract_json_content(response: Any) -> dict:
    """Extract and parse JSON from LLM response content."""
    content = getattr(response, "content", None) or str(response)
    if isinstance(content, list):
        text_parts = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                text_parts.append(block.get("text", ""))
            elif hasattr(block, "text"):
                text_parts.append(block.text)
        content = " ".join(text_parts)
    content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
    content = re.sub(r"<think>.*$", "", content, flags=re.DOTALL).strip()
    if "```" in content:
        match = re.search(r"```(?:json)?\s*([\s\S]+?)```", content)
        if match:
            content = match.group(1).strip()
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        logger.warning("Failed to parse JSON from LeadInvestigator output: %s", (content or "")[:300])
        return {}


class BasePoliceAgent:
    """Base for police agents: LLM client and _call_llm returning parsed JSON."""

    def __init__(self) -> None:
        self._llm = _make_llm()

    async def _call_llm(self, system_prompt: str, human_text: str) -> dict:
        """Invoke LLM and return parsed JSON."""
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=human_text),
        ]
        try:
            response = await self._llm.ainvoke(messages)
            return _extract_json_content(response)
        except Exception as exc:
            logger.exception("LLM call failed in %s: %s", self.__class__.__name__, exc)
            return {}
