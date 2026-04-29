"""
AI chat router for FinScore PME.

Workflow:
1) Detect intent from user message (keyword routing).
2) Invoke internal backend tools.
3) Build structured context.
4) Generate final answer with OpenAI when configured, otherwise fallback.
"""

from __future__ import annotations

import json
import logging
import re
from collections import defaultdict, deque
from threading import Lock
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.config import settings
from core.database import get_db
from ml_services.chat_tools import get_finscore, get_shap_explanation, get_sme_profile
from schemas.chat import ChatRequest, ChatResponse

logger = logging.getLogger(__name__)
router = APIRouter()


# In-memory per-user chat memory (bounded to last 10 messages).
_MEMORY_MAX_MESSAGES = 10
_chat_memory: dict[str, deque[dict[str, str]]] = defaultdict(
    lambda: deque(maxlen=_MEMORY_MAX_MESSAGES)
)
_chat_memory_lock = Lock()


INTENT_KEYWORDS: dict[str, tuple[str, ...]] = {
    "score": (
        "score",
        "finscore",
        "risk",
        "decision",
        "approved",
        "rejected",
        "credit",
    ),
    "explanation": (
        "explain",
        "why",
        "shap",
        "driver",
        "feature",
        "improve",
        "strength",
        "weakness",
    ),
    "profile": (
        "profile",
        "company",
        "sector",
        "governorate",
        "marketplace",
        "public",
        "private",
    ),
    "general": (
        "hi",
        "hello",
        "hey",
        "thanks",
        "thank you",
        "do you understand",
        "who are you",
        "what can you do",
    ),
    "growth": (
        "growth",
        "grow",
        "advice",
        "strategy",
        "expand",
        "sales",
        "marketing",
        "improve business",
        "scale",
    ),
}


PROJECT_SCOPE_KEYWORDS: tuple[str, ...] = (
    "finscore",
    "pme",
    "sme",
    "credit",
    "risk",
    "score",
    "shap",
    "explain",
    "profile",
    "company",
    "marketplace",
    "investor",
    "dashboard",
    "compliance",
    "rne",
    "cnss",
    "steg",
    "sonede",
    "banking",
    "turnover",
    "margin",
    "workers",
    "growth",
    "grow",
    "advice",
    "strategy",
    "scale",
    "sales",
    "marketing",
    "improve business",
    "predict",
    "what-if",
    "auth",
    "login",
    "register",
)


FOLLOW_UP_ACKS: tuple[str, ...] = (
    "yes",
    "yeah",
    "yep",
    "ok",
    "okay",
    "sure",
    "go ahead",
    "continue",
)


def detect_intents(message: str) -> list[str]:
    """Detect one or more intents using keyword routing."""

    normalized = message.lower().strip()
    matched: list[str] = []

    for intent, keywords in INTENT_KEYWORDS.items():
        if any(keyword in normalized for keyword in keywords):
            matched.append(intent)

    # Default to general intent for neutral conversations.
    if not matched:
        return ["general"]
    return matched


def _get_conversation_memory(user_id: str) -> list[dict[str, str]]:
    """Return a copy of the current memory for a user."""

    with _chat_memory_lock:
        return list(_chat_memory[user_id])


def _append_conversation_message(user_id: str, role: str, content: str) -> None:
    """Append a message to user memory while preserving max history size."""

    if role not in {"user", "assistant"}:
        return

    clean = (content or "").strip()
    if not clean:
        return

    with _chat_memory_lock:
        _chat_memory[user_id].append({"role": role, "content": clean})


def _is_project_related(message: str) -> bool:
    """Return True if message is in FinScore PME project scope."""

    normalized = message.lower().strip()
    return any(keyword in normalized for keyword in PROJECT_SCOPE_KEYWORDS)


def _is_follow_up_ack(message: str) -> bool:
    normalized = message.lower().strip()
    return normalized in FOLLOW_UP_ACKS


def _is_project_related_with_context(
    message: str,
    previous_memory: list[dict[str, str]],
) -> bool:
    """Allow short follow-ups if the previous user turn was in project scope."""

    if _is_project_related(message):
        return True

    if not _is_follow_up_ack(message):
        return False

    for item in reversed(previous_memory):
        if item.get("role") != "user":
            continue
        prev_user_message = item.get("content", "")
        return _is_project_related(prev_user_message)

    return False


FEATURE_RECOMMENDATIONS: dict[str, str] = {
    "business_expenses_tnd": "Reduce non-essential operating costs and negotiate supplier terms to improve margin quality.",
    "profit_margin": "Raise net margin via pricing review, cost control, and stronger product/service mix.",
    "compliance_rne_score": "Improve regulatory compliance documentation and filing consistency (RNE-related controls).",
    "formal_worker_ratio": "Increase formally declared employees and keep CNSS declarations up to date.",
    "workers_verified_cnss": "Improve payroll verification and ensure employee status is fully documented.",
    "steg_sonede_score": "Stabilize utility payment behavior to reflect stronger operational discipline.",
    "banking_maturity_score": "Strengthen banking traceability with regular documented transactions and account discipline.",
    "business_turnover_tnd": "Grow recurring turnover through reliable contracts and diversified revenue channels.",
    "posts_per_month": "Increase consistent monthly digital activity to improve behavioral traction signals.",
    "followers_fcb": "Build stronger Facebook audience engagement with regular high-quality content.",
    "followers_insta": "Improve Instagram reach and engagement to strengthen market presence signals.",
    "followers_linkedin": "Increase LinkedIn business visibility through consistent professional updates.",
}


def _humanize_feature_name(feature: str) -> str:
    return feature.replace("_", " ").strip().title()


def _is_improvement_request(message: str) -> bool:
    normalized = message.lower().strip()
    triggers = ("improve", "improvement", "increase", "raise", "boost", "better", "how to")
    return any(token in normalized for token in triggers)


def _build_improvement_plan(explanation_payload: dict[str, Any]) -> list[str]:
    negatives = explanation_payload.get("top_negative_drivers", []) or []
    actions: list[str] = []

    for item in negatives[:5]:
        feature = item.get("feature")
        if not feature:
            continue
        recommendation = FEATURE_RECOMMENDATIONS.get(feature)
        if recommendation:
            actions.append(f"{_humanize_feature_name(feature)}: {recommendation}")

    if not actions:
        actions.append("Improve cost discipline, workforce formalization, and compliance consistency in the next reporting cycle.")

    # Deduplicate while preserving order.
    deduped: list[str] = []
    for action in actions:
        if action not in deduped:
            deduped.append(action)
    return deduped[:4]


def _build_fallback_answer(message: str, data: dict[str, Any]) -> str:
    """Generate a deterministic, user-friendly response without external LLM."""

    score_payload = data.get("finscore") or {}
    profile_payload = data.get("profile") or {}
    explanation_payload = data.get("shap_explanation") or {}

    lines: list[str] = []

    has_tool_context = any(key in data for key in ("finscore", "shap_explanation", "profile"))

    if not has_tool_context:
        return (
            "I understand you. I can help with:\n"
            "1. Your latest FinScore and risk decision\n"
            "2. Top strengths and weaknesses\n"
            "3. A concrete action plan to improve your score\n"
            "\n"
            "Try one of these:\n"
            "- Show my score\n"
            "- Show my top weaknesses\n"
            "- How can I improve my score?"
        )

    if profile_payload.get("available"):
        profile = profile_payload.get("profile", {})
        lines.append("Company")
        lines.append(
            f"- {profile.get('company_name', 'N/A')} ({profile.get('sector', 'Unknown sector')}, {profile.get('governorate', 'Unknown governorate')})"
        )
    elif "profile" in data:
        lines.append("Company")
        lines.append(f"- Profile data unavailable: {profile_payload.get('reason', 'No details')}.")

    if score_payload.get("available"):
        lines.append("Score Snapshot")
        lines.append(
            f"- FinScore: {score_payload.get('score', 'N/A')}/1000"
        )
        lines.append(f"- Risk tier: {score_payload.get('risk_tier', 'N/A')}")
        lines.append(f"- Decision: {score_payload.get('decision', 'N/A')}")
        explanation = score_payload.get("decision_explanation")
        if explanation:
            lines.append(f"- Why: {explanation}")
    elif "finscore" in data:
        lines.append("Score Snapshot")
        lines.append(f"- FinScore data unavailable: {score_payload.get('reason', 'No details')}.")

    if explanation_payload.get("available"):
        positives = explanation_payload.get("top_positive_drivers", [])
        negatives = explanation_payload.get("top_negative_drivers", [])

        lines.append("Drivers")
        if positives:
            top_pos = ", ".join(_humanize_feature_name(item["feature"]) for item in positives[:3])
            lines.append(f"- Strengths: {top_pos}")
        if negatives:
            top_neg = ", ".join(_humanize_feature_name(item["feature"]) for item in negatives[:3])
            lines.append(f"- Weaknesses: {top_neg}")
    elif "shap_explanation" in data:
        lines.append("Drivers")
        lines.append(f"- Explanation data unavailable: {explanation_payload.get('reason', 'No details')}.")

    if _is_improvement_request(message):
        plan = _build_improvement_plan(explanation_payload)
        lines.append("Action Plan To Improve Score")
        for idx, action in enumerate(plan, start=1):
            lines.append(f"{idx}. {action}")

    if not _is_improvement_request(message):
        lines.append("Next step: ask \"How can I improve my score?\" for a focused action plan.")

    return "\n".join(lines)


def _normalize_answer_format(answer: str) -> str:
    """Convert common markdown patterns into plain text for chat UI readability."""

    cleaned = answer.strip()

    # Remove markdown heading markers at line start.
    cleaned = re.sub(r"(?m)^\s*#{1,6}\s*", "", cleaned)

    # Convert bold/italic markdown markers to plain text.
    cleaned = re.sub(r"\*\*(.*?)\*\*", r"\1", cleaned)
    cleaned = re.sub(r"\*(.*?)\*", r"\1", cleaned)
    cleaned = re.sub(r"__(.*?)__", r"\1", cleaned)
    cleaned = re.sub(r"_(.*?)_", r"\1", cleaned)

    # Normalize bullet markers for consistent display.
    cleaned = re.sub(r"(?m)^\s*[-*]\s+", "- ", cleaned)

    # Collapse excessive empty lines.
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)

    return cleaned.strip()


def _resolve_llm_runtime_config() -> dict[str, str | None]:
    """Resolve GitHub Models runtime config."""

    provider = "github"
    api_key = settings.GITHUB_API_KEY or settings.LLM_API_KEY
    model = settings.GITHUB_MODEL or settings.LLM_MODEL or "openai/gpt-5"
    default_base_url = "https://models.inference.ai.azure.com"
    base_url = settings.LLM_BASE_URL or default_base_url

    return {
        "provider": provider,
        "api_key": api_key,
        "model": model,
        "base_url": base_url,
    }


async def _generate_llm_answer(message: str, data: dict[str, Any]) -> str:
    """Generate answer via configured OpenAI-compatible LLM provider."""

    llm_cfg = _resolve_llm_runtime_config()
    api_key = llm_cfg["api_key"]
    model = llm_cfg["model"]
    base_url = llm_cfg["base_url"]

    if not api_key:
        if settings.LLM_FALLBACK_ENABLED:
            return _build_fallback_answer(message=message, data=data)
        raise RuntimeError("LLM is not configured: missing GITHUB_API_KEY/LLM_API_KEY.")

    system_prompt = (
        "You are FinScore PME AI Assistant. "
        "Use only the provided structured data to answer. "
        "If no structured tool data is provided, answer conversationally and ask a useful follow-up question. "
        "Do not repeat or restate the user's question. "
        "Reply in a clear, practical format with short sections and direct action points when applicable. "
        "For improvement requests, provide prioritized concrete recommendations tied to weak features. "
        "Be concise, factual, and never invent values not present in context."
    )

    memory_messages = data.get("conversation_memory", [])

    payload = {
        "model": model,
        "temperature": 0.2,
        "messages": (
            [{"role": "system", "content": system_prompt}]
            + memory_messages
            + [{
                "role": "user",
                "content": (
                    f"Current user message:\n{message}\n\n"
                    f"Structured context:\n{data}"
                ),
            }]
        ),
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                f"{base_url.rstrip('/')}/chat/completions",
                json=payload,
                headers=headers,
            )
            if response.status_code >= 400:
                response_text = response.text
                detail = response_text
                try:
                    payload_json = response.json()
                    detail = json.dumps(payload_json, ensure_ascii=True)
                except Exception:
                    pass
                raise RuntimeError(
                    "LLM request failed "
                    f"({response.status_code}) at {base_url.rstrip('/')}/chat/completions: {detail}"
                )
            response_json = response.json()

        answer = response_json["choices"][0]["message"]["content"].strip()
        if not answer:
            if settings.LLM_FALLBACK_ENABLED:
                return _build_fallback_answer(message=message, data=data)
            raise RuntimeError("LLM returned an empty response.")
        return _normalize_answer_format(answer)
    except Exception as exc:
        logger.error("LLM generation failed: %s", exc)
        if settings.LLM_FALLBACK_ENABLED:
            return _build_fallback_answer(message=message, data=data)
        raise


@router.post("", response_model=ChatResponse, status_code=status.HTTP_200_OK)
async def chat(req: ChatRequest, db: Session = Depends(get_db)) -> ChatResponse:
    """
    Production chat endpoint.

    Request body:
      { user_id, message }

    Response body:
      { answer, data }
    """

    message = req.message.strip()
    user_id = str(req.user_id)
    previous_memory = _get_conversation_memory(user_id=user_id)
    if not message:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Message cannot be empty.",
        )

    # Capture incoming user message in memory first.
    _append_conversation_message(user_id=user_id, role="user", content=message)

    if not _is_project_related_with_context(message=message, previous_memory=previous_memory):
        return ChatResponse(
            answer=(
                "I can only answer questions related to the FinScore PME project.\n"
                "Ask about scoring, risk tier, SHAP drivers, profile data, marketplace, or authentication."
            ),
            data={
                "user_id": user_id,
                "message": message,
                "scope": "out_of_scope",
            },
        )

    intents = detect_intents(message)
    data: dict[str, Any] = {
        "user_id": user_id,
        "message": message,
        "detected_intents": intents,
        "conversation_memory": _get_conversation_memory(user_id=user_id),
    }

    if "profile" in intents:
        data["profile"] = get_sme_profile(user_id=req.user_id, db=db)

    if "score" in intents:
        data["finscore"] = get_finscore(user_id=req.user_id, db=db)

    if "explanation" in intents:
        data["shap_explanation"] = get_shap_explanation(user_id=req.user_id, db=db)

    if "growth" in intents:
        # Growth guidance should be grounded in project data when available.
        data["profile"] = data.get("profile") or get_sme_profile(user_id=req.user_id, db=db)
        data["finscore"] = data.get("finscore") or get_finscore(user_id=req.user_id, db=db)
        data["shap_explanation"] = data.get("shap_explanation") or get_shap_explanation(user_id=req.user_id, db=db)

    # For generic conversation, we intentionally skip heavy score tool calls.
    if intents == ["general"]:
        data["assistant_mode"] = "general"

    try:
        answer = await _generate_llm_answer(message=message, data=data)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        )

    _append_conversation_message(user_id=user_id, role="assistant", content=answer)

    return ChatResponse(answer=answer, data=data)