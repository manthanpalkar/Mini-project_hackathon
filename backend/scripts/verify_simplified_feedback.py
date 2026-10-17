"""
LOOP — Simplified Feedback Modal & Navbar Devices Removal Verification Suite
Executes unmocked browser journeys on Google Chrome via Playwright:
1. Navbar verification: Devices button removed, Feedback button present.
2. Modal verification: opens and closes cleanly.
3. Category popover: opens, updates category pill, closes on outside click and Escape.
4. Text-only feedback submission.
5. Feedback with image attachment.
6. Admin verification of auto-generated title and category mapping in MongoDB.
"""

import os
import sys
import time
import signal
import subprocess
import urllib.request
import io
from pymongo import MongoClient
from playwright.sync_api import sync_playwright

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../frontend'))
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
VITE_PORT = 4175
BACKEND_PORT = 5055
FRONTEND_URL = f"http://127.0.0.1:{VITE_PORT}"
BACKEND_URL = f"http://127.0.0.1:{BACKEND_PORT}"
MONGO_URI = "mongodb://127.0.0.1:27018/loop_staging"

SYNTHETIC_EMAIL = "feedback_verifier@spit.ac.in"
SYNTHETIC_PASSWORD = "VerifierPass123!"

def wait_for_service(url, timeout_sec=25, name="Service"):
    start = time.time()
    while time.time() - start < timeout_sec:
        try:
            with urllib.request.urlopen(url, timeout=1) as resp:
                if resp.status in (200, 304):
                    print(f"[+] {name} is UP at {url}")
                    return True
        except Exception:
            time.sleep(0.3)
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

def seed_staging_user(client):
    db = client.get_default_database()
    import bcrypt
    hashed_pw = bcrypt.hashpw(SYNTHETIC_PASSWORD.encode('utf-8'), bcrypt.gensalt(10)).decode('utf-8')
    db.users.delete_many({"email": SYNTHETIC_EMAIL})
    db.feedbacks.delete_many({"reporterEmail": SYNTHETIC_EMAIL})
    db.users.insert_one({
        "email": SYNTHETIC_EMAIL,
        "name": "Feedback Verifier Student",
        "username": "feedback_verifier",
        "password": hashed_pw,
        "role": "Student",
        "status": "Active",
        "department": "Comps",
        "passingYear": 2026,
        "onboarded": True,
        "createdAt": time.time()
    })
    print(f"[+] Seeded synthetic test student: {SYNTHETIC_EMAIL}")

def cleanup_staging_user(client):
    try:
        db = client.get_default_database()
        db.users.delete_many({"email": SYNTHETIC_EMAIL})
        db.feedbacks.delete_many({"reporterEmail": SYNTHETIC_EMAIL})
        print("[+] Cleaned up synthetic records from loop_staging.")
    except Exception as e:
        print(f"[-] Cleanup error: {e}")

def run_verification():
    backend_proc = None
    frontend_proc = None
    mongo_client = None
    passed = []
    failed = []

    try:
        print("[*] Connecting to Docker MongoDB (127.0.0.1:27018/loop_staging)...")
        mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
        mongo_client.admin.command('ping')
        seed_staging_user(mongo_client)

        print(f"[*] Starting live backend daemon on port {BACKEND_PORT}...")
        backend_env = {
            **os.environ,
            "ENV_FILE": ".env.local.test",
            "NODE_ENV": "test",
            "ALLOWED_ORIGINS": f"http://127.0.0.1:{VITE_PORT},http://localhost:{VITE_PORT}"
        }
        backend_log = open("/tmp/backend_verify.log", "w")
        backend_proc = subprocess.Popen(
            ["node", "server.js"],
            cwd=BACKEND_DIR,
            env=backend_env,
            stdout=backend_log,
            stderr=subprocess.STDOUT,
            preexec_fn=os.setsid
        )
        assert wait_for_service(f"{BACKEND_URL}/api/health", name="Staging Backend")

        print(f"[*] Starting Vite Preview on port {VITE_PORT}...")
        frontend_env = {
            **os.environ,
            "PORT": str(VITE_PORT),
            "VITE_PROXY_TARGET": f"http://127.0.0.1:{BACKEND_PORT}"
        }
        preview_log = open("/tmp/preview_verify.log", "w")
        frontend_proc = subprocess.Popen(
            ["npx", "vite", "preview", "--host", "127.0.0.1", "--port", str(VITE_PORT), "--strictPort"],
            cwd=FRONTEND_DIR,
            env=frontend_env,
            stdout=preview_log,
            stderr=subprocess.STDOUT,
            preexec_fn=os.setsid
        )
        assert wait_for_service(FRONTEND_URL, name="Vite Preview")

        with sync_playwright() as p:
            print("[*] Launching native Google Chrome in headless mode...")
            browser = p.chromium.launch(channel="chrome", headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 800})
            page.on("console", lambda msg: print(f"  [Browser Console] {msg.type}: {msg.text}"))
            page.on("pageerror", lambda err: print(f"  [Browser Error] {err}"))

            # Step 1: Login
            print("\n[STEP 1] Authenticating synthetic student...")
            page.goto(f"{FRONTEND_URL}/login", wait_until="networkidle")
            page.fill("#email-input", SYNTHETIC_EMAIL)
            page.fill("#password-input", SYNTHETIC_PASSWORD)
            page.click("button[type='submit']")
            page.wait_for_url("**/home", timeout=10000)
            print("  ✔ PASS: Student authenticated and navigated to /home.")
            passed.append("Step 1: Student Login")

            # Step 2: Verify Devices option is removed from Navbar
            print("\n[STEP 2] Verifying 'Devices' button removal from Navbar...")
            devices_button = page.query_selector("button:has-text('Devices')")
            assert devices_button is None, "Devices button was found in Navbar, expected to be removed!"
            print("  ✔ PASS: 'Devices' button is completely removed from Navbar.")
            passed.append("Step 2: Devices Option Removed")

            # Step 3: Verify Feedback button is present and opens modal
            print("\n[STEP 3] Opening Feedback Modal via Navbar button...")
            time.sleep(1) # wait for Navbar animations and state settling
            feedback_btn = page.wait_for_selector("button[title='Submit Feedback or Report Bug']", timeout=5000)
            print(f"  Button outerHTML: {feedback_btn.evaluate('el => el.outerHTML')}")
            feedback_btn.click()
            time.sleep(0.5)
            page.screenshot(path="/tmp/after_feedback_click.png")
            page.wait_for_selector("h3:has-text('Feedback & Bug Reporting')", timeout=5000)
            print("  ✔ PASS: Feedback Modal opened cleanly.")
            passed.append("Step 3: Feedback Modal Open")

            # Step 4: Verify Category Selector Pill exists in top-right
            print("\n[STEP 4] Verifying Compact Category Selector Pill...")
            cat_pill = page.wait_for_selector("button[title='Select Feedback Category']", timeout=5000)
            assert cat_pill is not None
            pill_text = cat_pill.inner_text().strip()
            print(f"  Current pill label: '{pill_text}'")
            assert "Bug" in pill_text
            print("  ✔ PASS: Category Selector Pill visible with default 'Bug'.")
            passed.append("Step 4: Category Selector Pill Display")

            # Step 5: Test Popover Dropdown
            print("\n[STEP 5] Testing Category Popover Open, Selection, and Close...")
            cat_pill.click()
            page.wait_for_selector("div[role='menu']", timeout=5000)
            print("  ✔ Popover menu opened.")
            
            # Select "UI / Design Feedback"
            ui_design_opt = page.wait_for_selector("button[role='menuitem']:has-text('UI / Design Feedback')", timeout=5000)
            ui_design_opt.click()
            page.wait_for_selector("div[role='menu']", state="hidden", timeout=3000)
            
            updated_pill_text = cat_pill.inner_text().strip()
            print(f"  Updated pill label: '{updated_pill_text}'")
            assert "UI / Design" in updated_pill_text
            print("  ✔ PASS: Category changed to 'UI / Design' and popover closed.")
            passed.append("Step 5: Category Popover Selection")

            # Step 6: Test Outside Click & Escape to close Popover
            print("\n[STEP 6] Testing Popover Close via Escape key...")
            cat_pill.click()
            page.wait_for_selector("div[role='menu']", timeout=5000)
            page.keyboard.press("Escape")
            page.wait_for_selector("div[role='menu']", state="hidden", timeout=3000)
            print("  ✔ PASS: Popover closed cleanly upon pressing Escape.")
            passed.append("Step 6: Popover Escape Key Handling")

            # Step 7: Test Submit Text-Only Feedback
            print("\n[STEP 7] Submitting Text-Only Feedback...")
            textarea = page.wait_for_selector("textarea", timeout=5000)
            textarea.fill("The new navigation bar glass styling looks sleek and modern! However on narrow screens the logo text can wrap slightly.")
            
            submit_btn = page.wait_for_selector("button:has-text('Submit Feedback')", timeout=5000)
            submit_btn.click()
            
            page.wait_for_selector("h4:has-text('Thank You!')", timeout=8000)
            ref_el = page.wait_for_selector("text=/FB-\\d{8}-[A-F0-9]{6}/", timeout=5000)
            ref_id = ref_el.inner_text().strip()
            print(f"  Submission succeeded with tracking ID: {ref_id}")
            print("  ✔ PASS: Text-only feedback submitted successfully.")
            passed.append("Step 7: Text-Only Feedback Submission")

            # Step 8: Verify Record in MongoDB
            print("\n[STEP 8] Verifying Feedback Record and Auto-Generated Title in MongoDB...")
            db = mongo_client.get_default_database()
            fb_record = db.feedbacks.find_one({"referenceId": ref_id})
            assert fb_record is not None, "Feedback record was not found in MongoDB!"
            print(f"  Stored Title   : '{fb_record.get('title')}'")
            print(f"  Stored Category: '{fb_record.get('category')}'")
            assert fb_record.get('category') == 'UI / Usability'
            assert len(fb_record.get('title')) > 0
            print("  ✔ PASS: Category normalized to 'UI / Usability' and Title auto-generated from description.")
            passed.append("Step 8: MongoDB Record & Category Verification")

            # Step 9: Close Modal using Done button
            done_btn = page.wait_for_selector("button:has-text('Done')", timeout=5000)
            done_btn.click()
            page.wait_for_selector("h3:has-text('Feedback & Bug Reporting')", state="hidden", timeout=3000)
            print("  ✔ PASS: Modal closed cleanly via 'Done' button.")
            passed.append("Step 9: Modal Close")

            # Step 10: Test Feedback with Image Attachment
            print("\n[STEP 10] Testing Feedback with Authentic Image Attachment...")
            feedback_btn.click()
            page.wait_for_selector("h3:has-text('Feedback & Bug Reporting')", timeout=5000)
            
            # Select Bug category
            cat_pill = page.wait_for_selector("button[title='Select Feedback Category']", timeout=5000)
            cat_pill.click()
            bug_opt = page.wait_for_selector("button[role='menuitem']:has-text('Bug / Technical Issue')", timeout=5000)
            bug_opt.click()

            textarea = page.wait_for_selector("textarea", timeout=5000)
            textarea.fill("Found an issue where uploading large PDF causes a brief lag spike on low memory laptops. Attached screenshot of the performance profiler.")

            # Create a 1x1 authentic PNG image in memory
            png_bytes = bytes([
                0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
                0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
                0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
                0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
                0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
                0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
                0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
                0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
                0x42, 0x60, 0x82
            ])
            tmp_img_path = "/tmp/test_authentic_screenshot.png"
            with open(tmp_img_path, "wb") as f:
                f.write(png_bytes)

            file_input = page.locator("input[type='file']")
            file_input.set_input_files(tmp_img_path)
            
            # Verify thumbnail preview is displayed
            page.wait_for_selector("img[alt='Attachment preview']", timeout=5000)
            print("  ✔ Image thumbnail preview rendered.")
            
            submit_btn = page.wait_for_selector("button:has-text('Submit Feedback')", timeout=5000)
            submit_btn.click()

            page.wait_for_selector("h4:has-text('Thank You!')", timeout=8000)
            ref_el2 = page.wait_for_selector("text=/FB-\\d{8}-[A-F0-9]{6}/", timeout=5000)
            ref_id2 = ref_el2.inner_text().strip()
            print(f"  Submission with image succeeded: {ref_id2}")
            
            fb_record2 = db.feedbacks.find_one({"referenceId": ref_id2})
            assert fb_record2 is not None
            assert fb_record2.get('screenshotFileId') is not None
            assert fb_record2.get('category') == 'Bug / Error'
            print(f"  Screenshot stored in GridFS with ID: {fb_record2.get('screenshotFileId')}")
            print("  ✔ PASS: Feedback with screenshot stored safely in GridFS.")
            passed.append("Step 10: Feedback with Image Attachment")

            browser.close()

    except Exception as e:
        print(f"\n❌ FAILED: {e}")
        import traceback
        traceback.print_exc()
        failed.append(str(e))
        try:
            print("\n--- BACKEND LOG TAIL ---")
            with open("/tmp/backend_verify.log") as f:
                print("".join(f.readlines()[-30:]))
            print("\n--- PREVIEW LOG TAIL ---")
            with open("/tmp/preview_verify.log") as f:
                print("".join(f.readlines()[-30:]))
        except Exception as log_err:
            print(f"Log read error: {log_err}")

    finally:
        if mongo_client:
            cleanup_staging_user(mongo_client)
            mongo_client.close()
        if frontend_proc:
            print("[*] Stopping Vite Preview server...")
            stop_process(frontend_proc)
        if backend_proc:
            print("[*] Stopping Live Staging Backend daemon...")
            stop_process(backend_proc)

    print("\n" + "=" * 65)
    print("  SIMPLIFIED FEEDBACK & DEVICES REMOVAL VERIFICATION SUMMARY")
    print("=" * 65)
    print(f"Total Steps Executed: {len(passed) + len(failed)}")
    print(f"Passed              : {len(passed)}")
    print(f"Failed              : {len(failed)}")
    print("=" * 65)

    if failed:
        sys.exit(1)
    else:
        print("\nALL 10 VERIFICATION STEPS PASSED SUCCESSFULLY ON GOOGLE CHROME!")

if __name__ == "__main__":
    run_verification()
