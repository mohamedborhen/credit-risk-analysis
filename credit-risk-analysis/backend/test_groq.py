import httpx, json, os
from dotenv import load_dotenv

load_dotenv(".env")
api_key = os.getenv("GROQ_API_KEY")
print(f"Key: {api_key[:15]}...")

resp = httpx.post(
    "https://api.groq.com/openai/v1/chat/completions",
    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
    json={
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a financial data extractor. "
                    "Return ONLY a raw JSON with fields: website, sector, estimated_employees. "
                    "No markdown, no extra text."
                )
            },
            {"role": "user", "content": "Company name: Poulina Group Holding Tunisia"}
        ],
        "temperature": 0.1,
        "max_tokens": 128,
    },
    timeout=20.0,
)

print("Status:", resp.status_code)
content = resp.json()["choices"][0]["message"]["content"]
print("Response:", content)
parsed = json.loads(content)
print("Parsed:", parsed)
print("TEST PASSED")
