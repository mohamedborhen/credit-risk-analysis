import os
import sqlite3
from fastapi.testclient import TestClient

from main import app
from core.database import get_db, engine, Base
from models.orm import User, UserRole

# Recreate tables so new banker log schema applies locally directly inside script memory map
Base.metadata.create_all(bind=engine)

def test_ultimate():
    client = TestClient(app)

    # 1. Test Groq
    res1 = client.post("/enrich/groq", json={"company_name": "Vermeg"})
    res2 = client.post("/enrich/groq", json={"company_name": "Boulangerie Ben Ali"})
    
    cap1 = res1.json().get("data", {}).get("capital_tnd")
    cap2 = res2.json().get("data", {}).get("capital_tnd")
    
    print(f"Groq Vermeg Capital: {cap1}")
    print(f"Groq Ben Ali Capital: {cap2}")
    
    assert cap1 != cap2, "Groq LLM is still hallucinating identical numbers!"

    # 2. Test Banker
    # Insert mock banker bypass
    from core.database import SessionLocal
    db = SessionLocal()
    mock_banker = db.query(User).filter(User.email == "testbanker_sqlsave@bank.com").first()
    if not mock_banker:
        mock_banker = User(email="testbanker_sqlsave@bank.com", hashed_password="pw", role=UserRole.BANK)
        db.add(mock_banker)
        db.commit()
        db.refresh(mock_banker)

    res3 = client.post("/auth/token", data={"username": "testbanker_sqlsave@bank.com", "password": "any"})
    # wait auth/token actually checks hashed_password, so let's bypass via manual auth injecting directly:
    
    # Actually, we can use app.dependency_overrides to force the Banker user
    from core.security import get_current_user
    app.dependency_overrides[get_current_user] = lambda: mock_banker

    payload = {
        "company_name": "Test Banker Corp",
        "capital": 100000.0,
        "score": 850,
        "risk_tier": "Low Risk"
    }
    
    res_log = client.post("/scoring/logs", json=payload)
    print("Log Response:", res_log.json())
    assert res_log.status_code == 200, f"Logging failed: {res_log.text}"

    # Verify directly via SQLite
    conn = sqlite3.connect("finscore.db")
    c = conn.cursor()
    c.execute("SELECT score, risk_tier FROM banker_simulation_logs WHERE company_name='Test Banker Corp'")
    row = c.fetchone()
    conn.close()
    
    assert row is not None, "Banker simulation log NOT found in finscore.db!"
    assert row[0] == 850, "Banker simulation log score mismatch."
    
    db.close()
    print("ALL TESTS PASSED")

if __name__ == "__main__":
    test_ultimate()
