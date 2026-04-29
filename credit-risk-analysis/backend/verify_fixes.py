import sqlite3
import requests
import uuid
import uuid
import os

BASE_URL = "http://127.0.0.1:8000"
DB_PATH = "finscore.db"

def test_a_registration():
    print("--- TEST A: REGISTRATION ---")
    email = f"test_{uuid.uuid4().hex[:6]}@example.com"
    payload = {
        "email": email,
        "password": "SecurePassword123!",
        "role": "PME",
        "company_name": f"Test Company {uuid.uuid4().hex[:6]}",
        "sector": "Technology",
        "governorate": "Tunis",
        "is_pme": True
    }
    res = requests.post(f"{BASE_URL}/auth/register", json=payload)
    if res.status_code not in (200, 201):
        print(f"FAILED: Expected 201, got {res.status_code}. Response: {res.text}")
        return False, None, None
    print(f"PASSED: Registration returned {res.status_code}")
    
    data = res.json()
    user_id = data.get("user_id")
    token = data.get("access_token")

    # DB Check
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT email, credits FROM users WHERE id = ?", (user_id.replace('-', ''),))
    row = cursor.fetchone()
    conn.close()

    if row and row[0] == email:
        print(f"PASSED: DB persistence verified for user {email}")
        return True, user_id, token
    else:
        print(f"FAILED: User not found in DB")
        return False, None, None


def test_b_credit_deduction(token, profile_id):
    print("--- TEST B: CREDIT DEDUCTION ---")
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Get current credits from DB
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Check if profile exists, if not get any
    cursor.execute("SELECT id FROM pme_profiles LIMIT 1")
    pme = cursor.fetchone()
    if not pme:
        print("FAILED: No PME Profile found to test unlock.")
        return False, None
    
    # SQLite might return it as bytes or string
    raw_id = pme[0]
    pme_id = str(uuid.UUID(raw_id)) if isinstance(raw_id, str) and len(raw_id) == 32 else str(raw_id)
    
    # Get user
    cursor.execute("SELECT credits FROM users WHERE email LIKE 'test_%@example.com' ORDER BY created_at DESC LIMIT 1")
    initial_credits = cursor.fetchone()[0]
    conn.close()

    # 2. Hit unlock endpoint
    res = requests.post(f"{BASE_URL}/marketplace/{pme_id}/unlock_contact", headers=headers)
    if res.status_code != 200:
        print(f"FAILED: Unlock failed with {res.status_code}. Response: {res.text}")
        return False, pme_id
    
    # 3. Check DB again
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT credits FROM users WHERE email LIKE 'test_%@example.com' ORDER BY created_at DESC LIMIT 1")
    new_credits = cursor.fetchone()[0]
    conn.close()

    if new_credits == initial_credits - 1:
        print(f"PASSED: Credits decrypted perfectly in DB ({initial_credits} -> {new_credits})")
        return True, pme_id
    else:
        print(f"FAILED: Credits did not decrement properly. ({initial_credits} -> {new_credits})")
        return False, pme_id


def test_c_out_of_credits(token, user_id, pme_id):
    print("--- TEST C: OUT OF CREDITS ---")
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Force credits to 0
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET credits = 0 WHERE id = ?", (user_id.replace('-', ''),))
    conn.commit()
    conn.close()
    
    # 2. Hit unlock
    res = requests.post(f"{BASE_URL}/marketplace/{pme_id}/unlock_contact", headers=headers)
    if res.status_code == 402:
        print(f"PASSED: System correctly blocked unlock and returned 402. Response: {res.json()}")
        return True
    else:
        print(f"FAILED: Expected 402, got {res.status_code}. Response: {res.text}")
        return False

def test_d_delete_prediction(token):
    print("--- TEST D: DELETE PREDICTION ---")
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "company_name": "Test Delete Pred",
        "type_of_business": "Retail",
        "business_turnover_tnd": 50000,
        "business_expenses_tnd": 20000,
        "profit_margin": 0.6,
        "nbr_of_workers": 10,
        "workers_verified_cnss": 10,
        "formal_worker_ratio": 1.0,
        "business_age_years": 5,
        "number_of_owners": 1
    }
    
    # Create prediction
    res = requests.post(f"{BASE_URL}/scoring/predict", json=payload, headers=headers)
    if res.status_code != 201:
        print(f"FAILED: Predict failed. Status {res.status_code}")
        return False
        
    report_id = res.json().get("report_id")
    
    # Delete prediction
    res_del = requests.delete(f"{BASE_URL}/scoring/prediction/{report_id}", headers=headers)
    if res_del.status_code == 200:
        print("PASSED: Prediction deleted successfully.")
        return True
    else:
        print(f"FAILED: Delete prediction returned {res_del.status_code}. Response: {res_del.text}")
        return False

def test_e_delete_account(token, user_id):
    print("--- TEST E: GDPR ACCOUNT DELETION ---")
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Add some data first to ensure cascade deletes
    payload = {
        "company_name": "GDPR Co",
        "type_of_business": "Retail",
        "business_turnover_tnd": 50000,
        "business_expenses_tnd": 20000,
        "profit_margin": 0.6,
        "nbr_of_workers": 10,
        "workers_verified_cnss": 10,
        "formal_worker_ratio": 1.0,
        "business_age_years": 5,
        "number_of_owners": 1
    }
    requests.post(f"{BASE_URL}/scoring/predict", json=payload, headers=headers)
    
    # 2. Trigger Delete
    res = requests.delete(f"{BASE_URL}/auth/account", headers=headers)
    if res.status_code != 200:
        print(f"FAILED: Account delete returned {res.status_code}. Response: {res.text}")
        return False
        
    # 3. Verify SQLite Tables directly
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    raw_uid = user_id.replace('-', '')
    
    # Check User
    cursor.execute("SELECT COUNT(*) FROM users WHERE id = ?", (raw_uid,))
    user_count = cursor.fetchone()[0]
    
    # Since PME Profile is linked, find profile_id explicitly just to be safe, but it should be deleted.
    # However we know the user deletion should have purged it natively if cascading is right.
    cursor.execute("SELECT COUNT(*) FROM pme_profiles WHERE user_id = ?", (raw_uid,))
    pme_count = cursor.fetchone()[0]
    
    conn.close()
    
    if user_count == 0 and pme_count == 0:
        print("PASSED: SQLite cascading successfully removed orphaned rows.")
        return True
    else:
        print(f"FAILED: Found orphaned rows: User({user_count}), PMEProfile({pme_count})")
        return False


if __name__ == "__main__":
    passed_a, user_id, token = test_a_registration()
    if passed_a:
        passed_b, pme_id = test_b_credit_deduction(token, None)
        if passed_b:
            test_c_out_of_credits(token, user_id, pme_id)
            test_d_delete_prediction(token)
            test_e_delete_account(token, user_id)
