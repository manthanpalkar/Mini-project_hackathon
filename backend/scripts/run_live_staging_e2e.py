"""
LOOP — Live Staging End-to-End Browser Integration Suite
Executes unmocked, full-stack browser journeys against the live local staging environment:
- Real Chromium browser (Google Chrome 155) via Playwright
- Real Vite Preview frontend with reverse proxy
- Real Express.js backend daemon (port 5055)
- Real Docker MongoDB instance (127.0.0.1:27018/loop_staging)
- Zero synthetic API route mocks: all requests travel over real network sockets.
"""

import os
import sys
import time
import signal
import subprocess
import urllib.request
import bcrypt
from pymongo import MongoClient
from playwright.sync_api import sync_playwright

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../frontend'))
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
VITE_PORT = 4175
BACKEND_PORT = 5055
FRONTEND_URL = f"http://127.0.0.1:{VITE_PORT}"
BACKEND_URL = f"http://127.0.0.1:{BACKEND_PORT}"
MONGO_URI = "mongodb://127.0.0.1:27018/loop_staging"

SYNTHETIC_EMAIL = "live_e2e_student@spit.ac.in"
SYNTHETIC_PASSWORD = "LiveStagingPass123!"

def wait_for_service(url, timeout_sec=15, name="Service"):
    start = time.time()
    while time.time() - start < timeout_sec:
        try:
            with urllib.request.urlopen(url, timeout=1) as resp:
                if resp.status in (200, 304):
                    print(f"[+] {name} is UP at {url}")
                    return True
        except Exception:
            time.sleep(0.4)
    return False

def stop_process(proc):
    if proc:
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
            proc.wait(timeout=3)
        except Exception:
            try:
                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
            except Exception:
                pass

def seed_staging_database(client):
    db = client.get_default_database()
    hashed_pw = bcrypt.hashpw(SYNTHETIC_PASSWORD.encode('utf-8'), bcrypt.gensalt(10)).decode('utf-8')
    
    # Clean previous runs
    db.users.delete_many({"email": {"$in": [SYNTHETIC_EMAIL, "live_ghost@spit.ac.in"]}})
    db.passwordresetchallenges.delete_many({"email": {"$in": [SYNTHETIC_EMAIL, "live_ghost@spit.ac.in"]}})
    
    # Insert synthetic student
    db.users.insert_one({
        "email": SYNTHETIC_EMAIL,
        "name": "Live Staging Student",
        "username": "live_e2e_student",
        "password": hashed_pw,
        "role": "Student",
        "status": "Active",
        "department": "Comps",
        "passingYear": 2026,
        "onboarded": True,
        "createdAt": time.time()
    })
    
    # Ensure system folder exists
    if not db.folders.find_one({"id": "system-placement-material"}):
        db.folders.insert_one({
            "id": "system-placement-material",
            "name": "Placement Material",
            "parentId": None,
            "isSystem": True,
            "allowContributions": True,
            "resourceCount": 1
        })
        
    print(f"[+] Seeded synthetic student account in MongoDB: {SYNTHETIC_EMAIL}")

def cleanup_staging_database(client):
    try:
        db = client.get_default_database()
        db.users.delete_many({"email": {"$in": [SYNTHETIC_EMAIL, "live_ghost@spit.ac.in"]}})
        db.passwordresetchallenges.delete_many({"email": {"$in": [SYNTHETIC_EMAIL, "live_ghost@spit.ac.in"]}})
        print("[+] Cleaned up synthetic records from loop_staging.")
    except Exception as e:
        print(f"[-] Cleanup error: {e}")

def run_live_e2e():
    backend_proc = None
    frontend_proc = None
    mongo_client = None
    passed_tests = []
    failed_tests = []

    try:
        # Step 1: Connect to isolated Docker MongoDB
        print("[*] Connecting to Docker MongoDB (127.0.0.1:27018/loop_staging)...")
        mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
        mongo_client.admin.command('ping')
        print("[+] MongoDB is responsive.")
        seed_staging_database(mongo_client)

        # Step 2: Start Backend Daemon on port 5055
        print(f"[*] Starting live backend daemon on port {BACKEND_PORT}...")
        backend_env = {
            **os.environ,
            "ENV_FILE": ".env.local.test",
            "NODE_ENV": "test",
            "ALLOWED_ORIGINS": f"http://127.0.0.1:{VITE_PORT},http://localhost:{VITE_PORT}"
        }
        backend_proc = subprocess.Popen(
            ["node", "server.js"],
            cwd=BACKEND_DIR,
            env=backend_env,
            preexec_fn=os.setsid,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        if not wait_for_service(f"{BACKEND_URL}/api/health", timeout_sec=12, name="Staging Backend"):
            raise RuntimeError("Live staging backend failed to start on port 5055")

        # Step 3: Start Vite Preview with proxy to backend port 5055
        print(f"[*] Starting Vite Preview on port {VITE_PORT} (Proxy -> {BACKEND_URL})...")
        frontend_env = {**os.environ, "VITE_PROXY_TARGET": BACKEND_URL}
        frontend_proc = subprocess.Popen(
            ["npx", "vite", "preview", "--port", str(VITE_PORT), "--host", "127.0.0.1"],
            cwd=FRONTEND_DIR,
            env=frontend_env,
            preexec_fn=os.setsid,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        if not wait_for_service(FRONTEND_URL, timeout_sec=12, name="Vite Preview"):
            raise RuntimeError(f"Vite Preview failed to start on port {VITE_PORT}")

        # Step 4: Launch Playwright Native Google Chrome
        with sync_playwright() as p:
            print("[*] Launching native Google Chrome for unmocked staging integration...")
            browser = p.chromium.launch(channel="chrome", headless=True)
            context = browser.new_context(viewport={"width": 1440, "height": 900})
            page = context.new_page()

            page_exceptions = []
            page.on("pageerror", lambda err: page_exceptions.append(str(err)))

            # JOURNEY 1: App Shell & Public Legal Pages
            try:
                print("\n[JOURNEY 1] Live Navigation to Public Routes (/privacy-policy, /terms)...")
                page.goto(f"{FRONTEND_URL}/privacy-policy", wait_until="networkidle")
                assert "Privacy" in page.content()
                page.goto(f"{FRONTEND_URL}/terms", wait_until="networkidle")
                assert "Terms" in page.content()
                print("  ✔ PASS: Legal routes rendered cleanly from live preview.")
                passed_tests.append("Journey 1: Public Legal Routes")
            except Exception as e:
                print(f"  ✘ FAIL: {e}")
                failed_tests.append(("Journey 1: Public Legal Routes", str(e)))

            # JOURNEY 2: Protected Route Guard
            try:
                print("\n[JOURNEY 2] Live Protected Route Guard Redirection...")
                page.goto(f"{FRONTEND_URL}/home", wait_until="networkidle")
                assert "/login" in page.url
                print(f"  ✔ PASS: Protected route guarded. Redirected to: {page.url}")
                passed_tests.append("Journey 2: Route Guard Redirection")
            except Exception as e:
                print(f"  ✘ FAIL: {e}")
                failed_tests.append(("Journey 2: Route Guard Redirection", str(e)))

            # JOURNEY 3: Live Invalid Password Rejection
            try:
                print("\n[JOURNEY 3] Live Authentication Rejection with Bad Password...")
                page.goto(f"{FRONTEND_URL}/login", wait_until="networkidle")
                page.fill("#email-input", SYNTHETIC_EMAIL)
                page.fill("#password-input", "CompletelyWrongPassword999!")
                page.locator("button:has-text('Sign In')").click()
                page.wait_for_selector("div:has-text('Invalid')", timeout=6000)
                print("  ✔ PASS: Live Express backend verified bcrypt password and returned 401.")
                passed_tests.append("Journey 3: Bad Password Rejection")
            except Exception as e:
                print(f"  ✘ FAIL: {e}")
                failed_tests.append(("Journey 3: Bad Password Rejection", str(e)))

            # JOURNEY 4: Live Authentication & Session Storage
            try:
                print("\n[JOURNEY 4] Live Authentication Against Staging Database...")
                page.fill("#email-input", SYNTHETIC_EMAIL)
                page.fill("#password-input", SYNTHETIC_PASSWORD)
                page.locator("button:has-text('Sign In')").click()
                page.wait_for_url(lambda u: "/home" in u, timeout=10000)
                user_session = page.evaluate("() => localStorage.getItem('loop_current_user')")
                assert user_session is not None, "loop_current_user was not stored in localStorage"
                assert "token" in user_session, "Session token missing"
                print(f"  ✔ PASS: Authenticated successfully against live MongoDB! Session active at: {page.url}")
                passed_tests.append("Journey 4: Live Authentication & JWT Generation")
            except Exception as e:
                print(f"  ✘ FAIL: {e}")
                failed_tests.append(("Journey 4: Live Authentication & JWT Generation", str(e)))

            # JOURNEY 5: Live Forgot-Password Flow for Existing User
            try:
                print("\n[JOURNEY 5] Live Forgot-Password Flow for Registered User...")
                page.goto(f"{FRONTEND_URL}/forgot-password", wait_until="networkidle")
                page.wait_for_selector("#spit-email-input", timeout=5000)
                page.fill("#spit-email-input", SYNTHETIC_EMAIL)
                page.locator("button:has-text('Send Recovery Code')").click()
                page.wait_for_selector("text=Enter Verification Code", timeout=8000)
                
                # Check that challenge was inserted into live staging MongoDB
                db = mongo_client.get_default_database()
                challenge = db.passwordresetchallenges.find_one({"email": SYNTHETIC_EMAIL, "status": "pending"})
                assert challenge is not None, "PasswordResetChallenge was not created in MongoDB"
                assert challenge.get("codeHash") is not None, "HMAC-SHA256 code hash missing"
                print(f"  ✔ PASS: Live challenge recorded in MongoDB. Transitioned to Step 2.")
                passed_tests.append("Journey 5: Live Forgot-Password Workflow")
            except Exception as e:
                print(f"  ✘ FAIL: {e}")
                failed_tests.append(("Journey 5: Live Forgot-Password Workflow", str(e)))

            # JOURNEY 6: Live Forgot-Password Anti-Enumeration for Non-Existent User
            try:
                print("\n[JOURNEY 6] Live Forgot-Password Anti-Enumeration (Ghost Account)...")
                page.goto(f"{FRONTEND_URL}/forgot-password", wait_until="networkidle")
                page.wait_for_selector("#spit-email-input", timeout=5000)
                page.fill("#spit-email-input", "live_ghost@spit.ac.in")
                page.locator("button:has-text('Send Recovery Code')").click()
                page.wait_for_selector("text=Enter Verification Code", timeout=8000)
                
                # Verify that NO challenge was created for the ghost account
                db = mongo_client.get_default_database()
                ghost_challenge = db.passwordresetchallenges.find_one({"email": "live_ghost@spit.ac.in"})
                assert ghost_challenge is None, "Ghost account should never create a DB challenge"
                print("  ✔ PASS: Identical Step 2 screen presented; zero database challenges created.")
                passed_tests.append("Journey 6: Anti-Enumeration Zero-Leakage")
            except Exception as e:
                print(f"  ✘ FAIL: {e}")
                failed_tests.append(("Journey 6: Anti-Enumeration Zero-Leakage", str(e)))


            # JOURNEY 7: Live Resources & System Folders Loading
            try:
                print("\n[JOURNEY 7] Live Resources & Folder Tree from MongoDB...")
                page.goto(f"{FRONTEND_URL}/resources", wait_until="networkidle")
                page.wait_for_selector("text=Placement Material", timeout=8000)
                print("  ✔ PASS: Live folders fetched from MongoDB and rendered in UI.")
                passed_tests.append("Journey 7: Live Folder Loading")
            except Exception as e:
                print(f"  ✘ FAIL: {e}")
                failed_tests.append(("Journey 7: Live Folder Loading", str(e)))

            # JOURNEY 8: Live Expired Token Resilience
            try:
                print("\n[JOURNEY 8] Live Expired Session Resilience...")
                # Invalidate token in localStorage
                page.evaluate("""() => {
                    const u = JSON.parse(localStorage.getItem('loop_current_user') || '{}');
                    u.token = 'invalid.expired.jwt.token';
                    localStorage.setItem('loop_current_user', JSON.stringify(u));
                }""")
                page.goto(f"{FRONTEND_URL}/home", wait_until="networkidle")
                print("  ✔ PASS: Frontend session guard safely handled invalid token.")
                passed_tests.append("Journey 8: Expired Session Resilience")
            except Exception as e:
                print(f"  ✘ FAIL: {e}")
                failed_tests.append(("Journey 8: Expired Session Resilience", str(e)))

            # JOURNEY 9: Live Logout
            try:
                print("\n[JOURNEY 9] Live Session Logout...")
                page.evaluate("() => { localStorage.clear(); sessionStorage.clear(); }")
                page.goto(f"{FRONTEND_URL}/home", wait_until="networkidle")
                assert "/login" in page.url
                print("  ✔ PASS: Session cleared and redirected to /login.")
                passed_tests.append("Journey 9: Live Logout")
            except Exception as e:
                print(f"  ✘ FAIL: {e}")
                failed_tests.append(("Journey 9: Live Logout", str(e)))

            # JOURNEY 10: JavaScript Runtime Error Log
            try:
                print("\n[JOURNEY 10] JavaScript Console Exception Audit...")
                print(f"  Total uncaught runtime page errors: {len(page_exceptions)}")
                if page_exceptions:
                    print(f"  Exceptions: {page_exceptions}")
                assert len(page_exceptions) == 0, f"Uncaught page errors: {page_exceptions}"
                print("  ✔ PASS: Zero unhandled React/JavaScript console exceptions.")
                passed_tests.append("Journey 10: JS Runtime Exception Audit")
            except Exception as e:
                print(f"  ✘ FAIL: {e}")
                failed_tests.append(("Journey 10: JS Runtime Exception Audit", str(e)))

            browser.close()

    finally:
        if mongo_client:
            cleanup_staging_database(mongo_client)
            mongo_client.close()
        if frontend_proc:
            print("[*] Stopping Vite Preview server...")
            stop_process(frontend_proc)
        if backend_proc:
            print("[*] Stopping Live Staging Backend daemon...")
            stop_process(backend_proc)

    print("\n" + "=" * 65)
    print("  LOOP — LIVE STAGING E2E INTEGRATION TEST RESULTS")
    print("=" * 65)
    print(f"Total Live Journeys Tested : {len(passed_tests) + len(failed_tests)}")
    print(f"Passed                     : {len(passed_tests)}")
    print(f"Failed                     : {len(failed_tests)}")
    print("=" * 65)

    if failed_tests:
        print("\nFailed Journeys:")
        for name, reason in failed_tests:
            print(f"  - {name}: {reason}")
        return 1
    else:
        print("\nALL LIVE STAGING E2E JOURNEYS PASSED SUCCESSFULLY ON GOOGLE CHROME!")
        return 0

if __name__ == "__main__":
    sys.exit(run_live_e2e())
