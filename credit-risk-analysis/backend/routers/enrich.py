"""
Enrichissement B2B — Mock + Groq AI Scraper
--------------------------------------------
POST /enrich/company/mock  → Deterministic mock DB (3 Tunisian companies)
POST /enrich/grok          → Real AI enrichment via Groq API (groq.com)
                             Model: llama3-8b-8192 (fastest, free tier)
"""

import os
import json
import re

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import sys
import io

# Load .env from the backend directory
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

router = APIRouter()

def safe_print(*args, **kwargs):
    """Print that won't crash on Windows encoding errors."""
    try:
        print(*args, **kwargs)
    except UnicodeEncodeError:
        # Fallback for environments with limited charsets (like Windows CMD)
        new_args = [
            str(arg).encode(sys.stdout.encoding or 'ascii', errors='replace').decode(sys.stdout.encoding or 'ascii')
            if isinstance(arg, str) else arg
            for arg in args
        ]
        try:
            print(*new_args, **kwargs)
        except Exception:
            pass # Last resort: ignore print errors to avoid crashing logic

# ── Mock B2B Database ──────────────────────────────────────────────────────
MOCK_DB: dict = {
    "techtunisia": {
        "company_name": "TechTunisia SARL",
        "website": "techtunisia.tn",
        "employees": 42,
        "sector": "Technology / IT",
        "governorate": "Tunis",
        "description": "Development of B2B digital solutions for Tunisian SMEs.",
        "linkedin_followers": 1800,
        "founded_year": 2015,
        "rne_id": "1234567A",
    },
    "agrisfax": {
        "company_name": "AgriSfax Export",
        "website": "agrisfax.com.tn",
        "employees": 87,
        "sector": "Agriculture",
        "governorate": "Sfax",
        "description": "Export of certified organic olive oil and dates.",
        "linkedin_followers": 650,
        "founded_year": 2009,
        "rne_id": "7654321B",
    },
    "carthagelogistics": {
        "company_name": "Carthage Logistics Group",
        "website": "carthagelogistics.tn",
        "employees": 210,
        "sector": "Transport / Logistics",
        "governorate": "Ariana",
        "description": "Land logistics and transport covering Tunisia and the Maghreb.",
        "linkedin_followers": 4200,
        "founded_year": 2001,
        "rne_id": "9876543C",
    },
}


class EnrichRequest(BaseModel):
    company_name: str


# ── Mock endpoint ──────────────────────────────────────────────────────────
@router.post("/company/mock")
def enrich_company_mock(payload: EnrichRequest):
    """Mock B2B Enrichment — deterministic lookup."""
    key = payload.company_name.lower().replace(" ", "").replace("-", "").replace("_", "")

    matched = None
    for db_key, db_data in MOCK_DB.items():
        if db_key in key or key in db_key:
            matched = db_data
            break

    if matched:
        safe_print(f"[ENRICH MOCK] Match: '{payload.company_name}' → {matched['company_name']}")
        return {"status": "success", "source": "mock_b2b_api", "data": matched}
    else:
        safe_print(f"[ENRICH MOCK] No match for '{payload.company_name}'")
        return {
            "status": "partial",
            "source": "mock_b2b_api",
            "missing_fields": ["website", "employees", "sector", "description", "linkedin_followers"],
            "message": "Company not found in the mock database. Manual entry required.",
        }


# ── Groq AI Enrichment endpoint ────────────────────────────────────────────
# Groq API is OpenAI-compatible but uses groq.com infrastructure
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"  # current recommended model (llama3-8b-8192 decommissioned)

SYSTEM_PROMPT = (
    "You are a financial data API. Return ONLY a valid JSON object. Generate highly realistic, UNIQUE data based specifically on the scale implied by the company name. "
    "Do not use default fallback numbers. Ensure logical consistency (e.g., expenses < turnover, cnss_workers <= total_workers). "
    "The JSON object MUST STRICTLY contain ONLY these exact numeric keys: "
    "\"business_turnover_tnd\", \"business_expenses_tnd\", \"nbr_of_workers\", \"workers_verified_cnss\", "
    "\"business_age_years\", \"compliance_rne_score\" (0-10), \"steg_sonede_score\" (0-10), "
    "\"banking_maturity_score\" (0-10), \"followers_fcb\", \"followers_insta\", \"followers_linkedin\", \"posts_per_month\"."
)

@router.post("/groq")
async def enrich_company_groq(payload: EnrichRequest):
    """
    AI-powered enrichment via Groq API (groq.com).
    Uses LLaMA 3.3 70B — fast inference.
    Reads GROQ_API_KEY from .env file.
    """
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        safe_print("[GROQ] GROQ_API_KEY not set in .env")
        raise HTTPException(
            status_code=503,
            detail="Groq API key not configured. Set GROQ_API_KEY in backend/.env"
        )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    body = {
        "model": GROQ_MODEL,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a strict data extraction API for Tunisian companies. "
                    "You MUST return ONLY a raw JSON object. Do NOT wrap it in ```json blocks. "
                    "You MUST invent highly realistic data for the company name provided based on its likely sector. "
                    "If a value is unknown, make a highly educated guess. NEVER return null or missing fields. "
                    "You MUST strictly obey these exact limits for every field:\n"
                    "- business_age_years: integer (between 1 and 100)\n"
                    "- number_of_owners: integer (between 1 and 10)\n"
                    "- annual_turnover_tnd: integer (between 50000 and 100000000)\n"
                    "- annual_expenses_tnd: integer (must be strictly less than annual_turnover_tnd)\n"
                    "- total_workers: integer (between 2 and 5000)\n"
                    "- cnss_verified_workers: integer (must be less than or equal to total_workers)\n"
                    "- rne_compliance_score: integer (STRICTLY between 0 and 10)\n"
                    "- steg_sonede_rating: integer (STRICTLY between 0 and 10. Do not exceed 10)\n"
                    "- banking_maturity_score: integer (STRICTLY between 0 and 10)\n"
                    "- facebook_followers: integer (between 100 and 500000)\n"
                )
            },
            {
                "role": "user",
                "content": f"Return the JSON object for the company: {payload.company_name}"
            }
        ],
        "temperature": 0.8,
        "max_tokens": 512,
        "response_format": {"type": "json_object"}
    }

    safe_print(f"[GROQ] Calling Groq API for company: '{payload.company_name}' | model: {GROQ_MODEL}")

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(GROQ_API_URL, headers=headers, json=body)
            # safe_print("[GROQ] RAW RESPONSE:", response.text) # Too noisy and risky
            response.raise_for_status()

        groq_data = response.json()
        raw_content = groq_data["choices"][0]["message"]["content"].strip()
        safe_print(f"[GROQ] Raw response: {raw_content[:200]}...")

        # Parse JSON — handle potential markdown code blocks
        clean_content = raw_content.replace('```json', '').replace('```', '').strip()
        
        # Robust JSON extraction if LLM adds text around it
        if "{" in clean_content and "}" in clean_content:
            start = clean_content.find("{")
            end = clean_content.rfind("}") + 1
            clean_content = clean_content[start:end]

        try:
            extracted = json.loads(clean_content)
        except json.JSONDecodeError as e:
            safe_print(f"[GROQ ERROR] JSON Parse Error: {e} | Content: {clean_content[:100]}")
            raise HTTPException(status_code=500, detail=f"JSON Parse Error: {str(e)}")

        # Extract standard structure using explicit bounded properties
        result = {
            "business_turnover_tnd": extracted.get("business_turnover_tnd") or extracted.get("annual_turnover_tnd"),
            "business_expenses_tnd": extracted.get("business_expenses_tnd") or extracted.get("annual_expenses_tnd"),
            "nbr_of_workers": extracted.get("nbr_of_workers") or extracted.get("total_workers"),
            "workers_verified_cnss": extracted.get("workers_verified_cnss") or extracted.get("cnss_verified_workers"),
            "business_age_years": extracted.get("business_age_years"),
            "compliance_rne_score": extracted.get("compliance_rne_score") or extracted.get("rne_compliance_score"),
            "steg_sonede_score": extracted.get("steg_sonede_score") or extracted.get("steg_sonede_rating"),
            "banking_maturity_score": extracted.get("banking_maturity_score"),
            "followers_fcb": extracted.get("followers_fcb") or extracted.get("facebook_followers"),
            "followers_insta": extracted.get("followers_insta") or extracted.get("instagram_followers"),
            "followers_linkedin": extracted.get("followers_linkedin"),
            "posts_per_month": extracted.get("posts_per_month"),
        }

        # safe_print(f"[GROQ] Extracted: {result}")

        return {
            "status": "success",
            "source": "groq",
            "company_name": payload.company_name,
            "data": result,
        }

    except httpx.HTTPStatusError as e:
        safe_print(f"[GROQ ERROR] HTTP {e.response.status_code}: {e.response.text[:300]}")
        raise HTTPException(
            status_code=502,
            detail=f"Groq API error {e.response.status_code}: {e.response.text[:200]}"
        )
    except Exception as e:
        safe_print(f"[GROQ ERROR] {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Groq enrichment failed: {str(e)}"
        )
