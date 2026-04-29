import requests
import json

BASE_URL = "http://127.0.0.1:8000"

def run_tests():
    print("🚀 Starting API Integration Tests...")
    
    # 1. Health Check
    print("\n[1] Testing /health Endpoint...")
    res = requests.get(f"{BASE_URL}/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    print(f"✅ Health Check Passed: {res.json()}")

    # 2. Register PME User
    print("\n[2] Testing /auth/register (PME User)...")
    pme_user = {
        "email": "pme_test@tunisia.com",
        "password": "securepassword123",
        "role": "PME",
        "company_name": "TechCorp SME"
    }
    res = requests.post(f"{BASE_URL}/auth/register", json=pme_user)
    if res.status_code == 400 and "already registered" in res.text:
        print("⚠️ PME User already registered. Proceeding...")
    else:
        assert res.status_code in [200, 201], f"PME Registration failed: {res.text}"
        print(f"✅ PME Registration Passed: {res.json()}")

    # 3. Register BANK User
    print("\n[3] Testing /auth/register (BANK User)...")
    bank_user = {
        "email": "bank_test@tunisia.com",
        "password": "securepassword123",
        "role": "BANK"
    }
    res = requests.post(f"{BASE_URL}/auth/register", json=bank_user)
    if res.status_code == 400 and "already registered" in res.text:
        print("⚠️ BANK User already registered. Proceeding...")
    else:
        assert res.status_code in [200, 201], f"BANK Registration failed: {res.text}"
        print(f"✅ BANK Registration Passed: {res.json()}")

    # 4. Login PME User
    print("\n[4] Testing /auth/login (PME User)...")
    res = requests.post(f"{BASE_URL}/auth/login", json={"email": "pme_test@tunisia.com", "password": "securepassword123"})
    assert res.status_code == 200, f"PME Login failed: {res.text}"
    pme_token = res.json()["access_token"]
    print(f"✅ PME Login Passed. Token received (truncated): {pme_token[:15]}...")

    # 5. Login BANK User
    print("\n[5] Testing /auth/login (BANK User)...")
    res = requests.post(f"{BASE_URL}/auth/login", json={"email": "bank_test@tunisia.com", "password": "securepassword123"})
    assert res.status_code == 200, f"BANK Login failed: {res.text}"
    bank_token = res.json()["access_token"]
    print(f"✅ BANK Login Passed. Token received (truncated): {bank_token[:15]}...")

    # 6. Scoring Predict (PME Only)
    print("\n[6] Testing /scoring/predict (PME Scope)...")
    headers = {"Authorization": f"Bearer {pme_token}"}
    payload = {
        "business_turnover_tnd": 250000,
        "business_expenses_tnd": 100000,
        "profit_margin": 0.15,
        "cash_flow_tnd": 80000,
        "cnss_compliance_score": 1,
        "utility_bills_paid_on_time": 1,
        "type_of_business": "Tech"
    }
    res = requests.post(f"{BASE_URL}/scoring/predict", json=payload, headers=headers)
    assert res.status_code in [200, 201], f"Scoring Predict failed (Status {res.status_code}): {res.text}"
    print(f"✅ Scoring Predict Passed: {json.dumps(res.json(), indent=2)}")

    # 7. Marketplace Browse (BANK Only)
    print("\n[7] Testing /marketplace/browse (BANK Scope)...")
    headers = {"Authorization": f"Bearer {bank_token}"}
    res = requests.get(f"{BASE_URL}/marketplace/browse", headers=headers)
    assert res.status_code == 200, f"Marketplace Browse failed: {res.text}"
    print(f"✅ Marketplace Browse Passed: {len(res.json()['listings'])} profiles retrieved.")
    print(json.dumps(res.json()['listings'], indent=2))

    print("\n🎉 ALL API TESTS PASSED SUCCESSFULLY! The Backend is fully verified.")

if __name__ == "__main__":
    run_tests()
