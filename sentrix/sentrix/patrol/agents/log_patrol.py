"""
LogPatrolAgent — safety patrol over agent log turns.

No domain-specific tools; receives a batch of log turns and returns
ThreatSignal + optional ViolationVote.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from sentrix.patrol.config import (
    CONFIDENCE_THRESHOLD,
    PATROL_ANTHROPIC_API_KEY,
    PATROL_DEPLOYMENT,
    PATROL_MAX_TOKENS,
    PATROL_MODEL_ANTHROPIC,
    PATROL_MODEL_OPENAI,
    PATROL_OPENAI_API_KEY,
    PATROL_TEMPERATURE,
)
from sentrix.patrol.models import Severity, ThreatSignal, ViolationVote
from sentrix.patrol.prompts import LOG_PATROL_SYSTEM

logger = logging.getLogger(__name__)


def _extract_json_content(response: Any) -> dict:
    """Parse JSON from LLM response."""
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
    if "```" in content:
        match = re.search(r"```(?:json)?\s*([\s\S]+?)```", content)
        if match:
            content = match.group(1).strip()
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return {
            "severity": "CLEAN",
            "confidence": 0.0,
            "category": None,
            "pii_labels_detected": [],
            "observation": "JSON parse error in LLM output.",
        }


class LogPatrolAgent:
    """Single patrol agent for log safety; no tools."""

    def __init__(
        self,
        name: str = "log_patrol_0",
        *,
        system_prompt: str | None = None,
    ) -> None:
        self.name = name
        self.domain = "log"
        self.system_prompt = system_prompt or LOG_PATROL_SYSTEM
        self._llm = self._make_llm()

    def _make_llm(self):
        if PATROL_DEPLOYMENT == "anthropic" and PATROL_ANTHROPIC_API_KEY:
            from langchain_anthropic import ChatAnthropic
            return ChatAnthropic(
                api_key=PATROL_ANTHROPIC_API_KEY,
                model=PATROL_MODEL_ANTHROPIC,
                temperature=PATROL_TEMPERATURE,
                max_tokens=PATROL_MAX_TOKENS,
            )
        if PATROL_OPENAI_API_KEY:
            from langchain_openai import ChatOpenAI
            return ChatOpenAI(
                api_key=PATROL_OPENAI_API_KEY,
                model=PATROL_MODEL_OPENAI,
                temperature=PATROL_TEMPERATURE,
                max_tokens=PATROL_MAX_TOKENS,
            )
        raise RuntimeError(
            "Patrol requires OPENAI_API_KEY or ANTHROPIC_API_KEY (or PATROL_* equivalents)"
        )

    def _build_human_message(self, turns: list[dict]) -> str:
        """Format log turns for the model."""
        parts = []
        for i, t in enumerate(turns):
            run_id = t.get("run_id", "")
            ts = t.get("ts", "")
            text = t.get("text", "")
            thinking = t.get("thinking", "")
            user_msgs = t.get("user_messages") or []
            parts.append(f"--- Turn {i + 1} (run_id={run_id}, ts={ts}) ---")
            if user_msgs:
                for um in user_msgs:
                    role = um.get("role", "user")
                    content = um.get("content", um.get("text", ""))
                    if isinstance(content, list):
                        content = " ".join(
                            c.get("text", str(c)) for c in content if isinstance(c, dict)
                        )
                    parts.append(f"[{role}]: {content}")
            if thinking:
                parts.append(f"[thinking]: {thinking[:2000]}{'...' if len(thinking) > 2000 else ''}")
            parts.append(f"[assistant]: {text[:4000]}{'...' if len(text) > 4000 else ''}")
        return "\n\n".join(parts)

    async def scan(
        self,
        source_file: str,
        actions: list[dict],
        agent_profile: dict | None = None,
        pheromone_level: float = 0.0,
    ) -> tuple[ThreatSignal, ViolationVote | None]:
        """Run patrol on a batch of log turns. source_file is the log stream id (e.g. 20260310T185751.json). Returns (signal, vote or None)."""
        agent_profile = agent_profile or {}
        human_text = self._build_human_message(actions)
        messages = [
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=human_text),
        ]
        try:
            response = await self._llm.ainvoke(messages)
            raw = _extract_json_content(response)
        except Exception as exc:
            logger.exception("Patrol LLM call failed for %s", self.name)
            raw = {
                "severity": "CLEAN",
                "confidence": 0.0,
                "category": None,
                "pii_labels_detected": [],
                "observation": f"Scan failed: {exc}",
            }
        severity = Severity(raw.get("severity", "CLEAN"))
        confidence = float(raw.get("confidence", 0.0))
        category = raw.get("category")
        if category and not isinstance(category, str):
            category = str(category) if category else None
        pii_labels = list(raw.get("pii_labels_detected", [])) if isinstance(raw.get("pii_labels_detected"), list) else []
        observation = str(raw.get("observation", ""))

        signal = ThreatSignal(
            source_agent=self.name,
            source_file=source_file,
            domain=self.domain,
            severity=severity,
            confidence=confidence,
            pii_labels_detected=pii_labels,
            observation=observation,
            category=category,
        )
        vote: ViolationVote | None = None
        if severity != Severity.CLEAN and confidence >= CONFIDENCE_THRESHOLD:
            vote = ViolationVote(
                source_agent=self.name,
                source_file=source_file,
                severity=severity,
                confidence=confidence,
                pii_labels_detected=pii_labels,
                observation=observation,
                category=category,
            )
        return signal, vote
