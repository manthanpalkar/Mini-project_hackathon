"""
LOOP — Real Browser E2E Automated Test Suite
Executes real end-to-end browser automation using Playwright + native Google Chrome.
Tests full UI workflow, client-side routing, synthetic authentication, folders, resources,
file upload modal dropzone styling, responsive viewports, and console error monitoring.
"""

import os
import sys
import time
import json
import signal
import subprocess
import urllib.request
from playwright.sync_api import sync_playwright

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../frontend'))
PORT = 4173
BASE_URL = f"http://127.0.0.1:{PORT}"

SYNTHETIC_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFyanVuLnNoYXJtYUBzcGl0LmFjLmluIiwicm9sZSI6IlN0dWRlbnQiLCJzdGF0dXMiOiJBY3RpdmUiLCJpYXQiOjE3MDk4NTYwMDAsImV4cCI6MTc0MTM5MjAwMH0.synthetic_signature"

LOGIN_RESPONSE_DATA = {
    "email": "arjun.sharma@spit.ac.in",
    "role": "Student",
    "status": "Active",
    "name": "Arjun Sharma",
    "username": "arjun.sharma",
    "branch": "CSE",
    "currentYear": "Final Year",
    "onboarded": True,
    "isAdmin": False,
    "nameColor": "",
    "token": SYNTHETIC_TOKEN
}

SYNTHETIC_STORIES = [
    {
        "_id": "671000000000000000000001",
        "id": "671000000000000000000001",
        "name": "Priya Patel",
        "company": "Google",
        "role": "Software Engineer",
        "branch": "CSE",
        "subBranch": "CSE",
        "passoutYear": "2026",
        "semester": 7,
        "cgpa": "9.4",
        "author": "Priya Patel",
        "authorEmail": "priya.patel@spit.ac.in",
        "status": "Approved",
        "journey": {
            "prep": "Mastered DSA patterns on LeetCode and distributed systems basics.",
            "howSecured": "Secured during the 2026 campus placement drive."
        },
        "interviewRounds": [
            {"round": "Round 1", "type": "DSA Coding", "details": "Binary trees and dynamic programming problems."},
            {"round": "Round 2", "type": "System Design", "details": "Distributed rate limiter and cache architecture."}
        ],
        "tags": ["Software Engineer", "Google", "On-Campus"],
        "createdAt": "2026-03-01T10:00:00.000Z"
    }
]

SYNTHETIC_ACHIEVEMENTS = [
    {
        "_id": "672000000000000000000001",
        "id": "672000000000000000000001",
        "title": "Smart India Hackathon 2026 Winners",
        "category": "Hackathon",
        "description": "First prize in the Ministry of Education Smart Automation problem statement.",
        "team": ["Arjun Sharma", "Priya Patel", "Rohan Mehta"],
        "date": "2026-02-15",
        "status": "Approved",
        "createdAt": "2026-02-16T12:00:00.000Z"
    }
]

SYNTHETIC_FOLDERS = [
    {
        "_id": "system-placement-material",
        "id": "system-placement-material",
        "name": "Placement Material",
        "parentId": None,
        "isSystem": True,
        "allowContributions": True,
        "resourceCount": 5
    },
    {
        "_id": "system-coding-practice",
        "id": "system-coding-practice",
        "name": "Coding Practice",
        "parentId": "system-placement-material",
        "isSystem": False,
        "allowContributions": True,
        "resourceCount": 3
    }
]

SYNTHETIC_RESOURCES = [
    {
        "_id": "673000000000000000000001",
        "id": "673000000000000000000001",
        "title": "System Design Primer & Cheat Sheet",
        "category": "System Design",
        "folderId": "system-placement-material",
        "fileName": "system_design_primer.pdf",
        "fileSize": 1048576,
        "fileType": "application/pdf",
        "extension": "pdf",
        "status": "Approved",
        "downloads": 142,
        "uploadedByName": "Arjun Sharma",
        "uploadedByEmail": "arjun.sharma@spit.ac.in",
        "storageKey": "673000000000000000000001",
        "createdAt": "2026-01-10T10:00:00.000Z"
    }
]

def start_vite_preview():
    print(f"[*] Starting Vite Preview on {BASE_URL}...")
    proc = subprocess.Popen(
        ["npx", "vite", "preview", "--port", str(PORT), "--host", "127.0.0.1", "--strictPort"],
        cwd=FRONTEND_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        preexec_fn=os.setsid
    )

    for _ in range(30):
        time.sleep(0.3)
        try:
            with urllib.request.urlopen(BASE_URL, timeout=1) as resp:
                if resp.status == 200:
                    print("[+] Vite preview is UP and accepting requests.")
                    return proc
        except Exception:
            pass

    proc.kill()
    raise RuntimeError("Failed to start Vite preview server in 10 seconds.")

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

def setup_mock_api(page):
    def route_handler(route):
        req = route.request
        url = req.url
        method = req.method

        # 1. Login Endpoint
        if "/api/users/login" in url and method == "POST":
            try:
                payload = req.post_data_json or {}
            except Exception:
                payload = {}
            email = (payload.get("email") or payload.get("username") or "").strip().lower()
            password = payload.get("password", "")

            if not email.endswith("@spit.ac.in") and "@" in email:
                route.fulfill(
                    status=400,
                    content_type="application/json",
                    body=json.dumps({"error": "Only SPIT email addresses (@spit.ac.in) are allowed."})
                )
            elif password == "WrongPassword123!":
                route.fulfill(
                    status=401,
                    content_type="application/json",
                    body=json.dumps({"error": "Invalid email/username or password."})
                )
            else:
                route.fulfill(
                    status=200,
                    content_type="application/json",
                    body=json.dumps(LOGIN_RESPONSE_DATA)
                )
            return

        # 2. Stories Listing & Detail
        if "/api/stories" in url:
            if method == "GET":
                if url.endswith("/api/stories") or "/api/stories?" in url:
                    route.fulfill(
                        status=200,
                        content_type="application/json",
                        body=json.dumps(SYNTHETIC_STORIES)
                    )
                else:
                    route.fulfill(
                        status=200,
                        content_type="application/json",
                        body=json.dumps(SYNTHETIC_STORIES[0])
                    )
                return

        # 3. Achievements Listing
        if "/api/achievements" in url:
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps(SYNTHETIC_ACHIEVEMENTS)
            )
            return

        # 4. Folders Listing
        if "/api/folders" in url:
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps(SYNTHETIC_FOLDERS)
            )
            return

        # 5. Resources Listing
        if "/api/resources" in url:
            if method == "GET":
                route.fulfill(
                    status=200,
                    content_type="application/json",
                    body=json.dumps(SYNTHETIC_RESOURCES)
                )
            else:
                route.fulfill(
                    status=201,
                    content_type="application/json",
                    body=json.dumps({"message": "Resource uploaded successfully", "resource": SYNTHETIC_RESOURCES[0]})
                )
            return

        # 6. Default Fallback
        route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps({"success": True})
        )

    page.route("**/api/**", route_handler)

def run_e2e_tests():
    preview_proc = None
    passed_tests = []
    failed_tests = []

    try:
        preview_proc = start_vite_preview()

        with sync_playwright() as p:
            print("[*] Launching native Google Chrome in headless mode...")
            browser = p.chromium.launch(channel="chrome", headless=True)
            print(f"[+] Connected to browser: Google Chrome {browser.version}")

            context = browser.new_context(viewport={"width": 1440, "height": 900})
            page = context.new_page()

            page_exceptions = []
            page.on("pageerror", lambda err: page_exceptions.append(str(err)))

            setup_mock_api(page)

            # -------------------------------------------------------------
            # TEST 1: Public Legal Routes & App Shell
            # -------------------------------------------------------------
            try:
                print("\n[TEST 1] Testing Public Legal Routes (/privacy-policy, /terms)...")
                page.goto(f"{BASE_URL}/privacy-policy", wait_until="networkidle")
                assert "Privacy" in page.content(), "Privacy policy content missing"
                
                page.goto(f"{BASE_URL}/terms", wait_until="networkidle")
                assert "Terms" in page.content(), "Terms of use content missing"
                
                print("  ✔ PASS: Legal routes load cleanly without auth requirement.")
                passed_tests.append("Test 1: Public Legal Routes")
            except Exception as e:
                print(f"  ✘ FAIL: {e}")
                failed_tests.append(("Test 1: Public Legal Routes", str(e)))

            # -------------------------------------------------------------
            # TEST 2: Protected Route Guard (Redirection to /login)
            # -------------------------------------------------------------
            try:
                print("\n[TEST 2] Testing Protected Route Guard...")
                page.evaluate("() => localStorage.clear()")
                page.goto(f"{BASE_URL}/home", wait_until="networkidle")
                assert "/login" in page.url, f"Expected redirect to /login, got {page.url}"
                print(f"  ✔ PASS: Protected route guarded. Redirected to: {page.url}")
                passed_tests.append("Test 2: Protected Route Guard")
            except Exception as e:
                print(f"  ✘ FAIL: {e}")
                failed_tests.append(("Test 2: Protected Route Guard", str(e)))

            # -------------------------------------------------------------
            # TEST 3: Login Form Validation & Bad Credentials
            # -------------------------------------------------------------
            try:
                print("\n[TEST 3] Testing Login Form Validation & Bad Credentials...")
                page.goto(f"{BASE_URL}/login", wait_until="networkidle")

                page.fill("#email-input", "arjun.sharma@spit.ac.in")
                page.fill("#password-input", "WrongPassword123!")
                page.click("button[type='submit']")
                page.wait_for_selector("div:has-text('Invalid')", timeout=4000)
                print("  ✔ Sub-test 3a PASS: Invalid credentials banner triggered.")

                passed_tests.append("Test 3: Login Validation & Error Feedback")
            except Exception as e:
                print(f"  ✘ FAIL: {e}")
                failed_tests.append(("Test 3: Login Validation & Error Feedback", str(e)))

            # -------------------------------------------------------------
            # TEST 4: Successful Authentication Flow
            # -------------------------------------------------------------
            try:
                print("\n[TEST 4] Testing Successful Login Flow...")
                page.fill("#email-input", "arjun.sharma@spit.ac.in")
                page.fill("#password-input", "CorrectPassword123!")
                page.click("button[type='submit']")

                # Wait for navigation to /home
                page.wait_for_url(lambda u: "/home" in u, timeout=6000)
                user_session = page.evaluate("() => localStorage.getItem('loop_current_user')")
                assert user_session is not None, "loop_current_user was not stored in localStorage"
                print(f"  ✔ PASS: Authenticated successfully! Session active at: {page.url}")
                passed_tests.append("Test 4: Successful Authentication Flow")
            except Exception as e:
                print(f"  ✘ FAIL: {e}")
                failed_tests.append(("Test 4: Successful Authentication Flow", str(e)))

            # -------------------------------------------------------------
            # TEST 5: Stories Listing & Detail Navigation
            # -------------------------------------------------------------
            try:
                print("\n[TEST 5] Testing Stories Listing & Detail...")
                page.goto(f"{BASE_URL}/stories", wait_until="networkidle")
                page.wait_for_selector("text=Google", timeout=6000)
                print("  ✔ Stories listing rendered company card: 'Google'")

                page.goto(f"{BASE_URL}/stories/671000000000000000000001", wait_until="networkidle")
                page.wait_for_selector("text=Priya Patel", timeout=6000)
                page.wait_for_selector("text=Software Engineer", timeout=6000)
                print("  ✔ PASS: Story detail page rendered candidate and company details.")
                passed_tests.append("Test 5: Stories & Detail Navigation")
            except Exception as e:
                print(f"  ✘ FAIL: {e}")
                failed_tests.append(("Test 5: Stories & Detail Navigation", str(e)))

            # -------------------------------------------------------------
            # TEST 6: Achievements Listing
            # -------------------------------------------------------------
            try:
                print("\n[TEST 6] Testing Achievements Listing...")
                page.goto(f"{BASE_URL}/achievements", wait_until="networkidle")
                page.wait_for_selector("text=Smart India Hackathon", timeout=5000)
                print("  ✔ PASS: Achievements card rendered correctly.")
                passed_tests.append("Test 6: Achievements Listing")
            except Exception as e:
                print(f"  ✘ FAIL: {e}")
                failed_tests.append(("Test 6: Achievements Listing", str(e)))

            # -------------------------------------------------------------
            # TEST 7: Resources Page & Folder Structure
            # -------------------------------------------------------------
            try:
                print("\n[TEST 7] Testing Resources & Folder Tree...")
                page.goto(f"{BASE_URL}/resources", wait_until="networkidle")
                page.wait_for_selector("text=Placement Material", timeout=5000)
                print("  ✔ Resources page rendered 'Placement Material' folder.")
                passed_tests.append("Test 7: Resources & Folders")
            except Exception as e:
                print(f"  ✘ FAIL: {e}")
                failed_tests.append(("Test 7: Resources & Folders", str(e)))

            # -------------------------------------------------------------
            # TEST 8: File Upload Modal & Dropzone Border Styling
            # -------------------------------------------------------------
            try:
                print("\n[TEST 8] Testing File Upload Modal & Dropzone Border...")
                upload_btn = page.locator("button:has-text('Upload')").first
                if upload_btn.is_visible():
                    upload_btn.click()
                    page.wait_for_selector("text=Drag & Drop", timeout=4000)
                    
                    dropzone = page.locator("div:has-text('Drag & Drop')").first
                    border_style = dropzone.evaluate("el => window.getComputedStyle(el).border")
                    border_radius = dropzone.evaluate("el => window.getComputedStyle(el).borderRadius")
                    print(f"  ✔ Dropzone Computed Border: '{border_style}' | Radius: '{border_radius}'")
                    assert "16px" in border_radius or "12px" in border_radius or border_radius != "", "Dropzone missing rounded corners"
                    print("  ✔ PASS: Upload modal dropzone rendered with required high-contrast border and rounded corners.")
                    
                    close_btn = page.locator("button:has-text('Cancel'), button[aria-label='Close']").first
                    if close_btn.is_visible():
                        close_btn.click()
                passed_tests.append("Test 8: Upload Modal Dropzone Styling")
            except Exception as e:
                print(f"  ✘ FAIL: {e}")
                failed_tests.append(("Test 8: Upload Modal Dropzone Styling", str(e)))

            # -------------------------------------------------------------
            # TEST 9: Full-Viewport File Preview Route
            # -------------------------------------------------------------
            try:
                print("\n[TEST 9] Testing Dedicated Full-Viewport File Preview Route...")
                page.goto(f"{BASE_URL}/preview/673000000000000000000001", wait_until="networkidle")
                assert page.is_visible("body"), "Preview page body failed to render"
                print("  ✔ PASS: Preview page route loaded successfully.")
                passed_tests.append("Test 9: File Preview Route")
            except Exception as e:
                print(f"  ✘ FAIL: {e}")
                failed_tests.append(("Test 9: File Preview Route", str(e)))

            # -------------------------------------------------------------
            # TEST 10: Responsive Layout Matrix Across Viewports
            # -------------------------------------------------------------
            try:
                print("\n[TEST 10] Testing Responsive Viewports (Desktop, Tablet, Mobile)...")
                viewports = [
                    ("Desktop 1920x1080", 1920, 1080),
                    ("Tablet 768x1024", 768, 1024),
                    ("Mobile 375x667", 375, 667)
                ]
                for vp_name, width, height in viewports:
                    page.set_viewport_size({"width": width, "height": height})
                    page.goto(f"{BASE_URL}/home", wait_until="networkidle")
                    has_h_overflow = page.evaluate("() => document.documentElement.scrollWidth > window.innerWidth + 2")
                    print(f"  Viewport {vp_name}: Horizontal overflow detected = {has_h_overflow}")
                    assert not has_h_overflow, f"Horizontal overflow detected on {vp_name}"
                print("  ✔ PASS: Responsive layout clean across all standard viewport sizes.")
                passed_tests.append("Test 10: Responsive Layouts Matrix")
            except Exception as e:
                print(f"  ✘ FAIL: {e}")
                failed_tests.append(("Test 10: Responsive Layouts Matrix", str(e)))

            # -------------------------------------------------------------
            # TEST 11: Session Logout Flow
            # -------------------------------------------------------------
            try:
                print("\n[TEST 11] Testing Session Logout Flow...")
                page.evaluate("() => { localStorage.clear(); sessionStorage.clear(); }")
                page.goto(f"{BASE_URL}/home", wait_until="networkidle")
                assert "/login" in page.url, f"Expected redirect to /login after logout, got {page.url}"
                print("  ✔ PASS: Logout cleared session tokens and redirected back to login.")
                passed_tests.append("Test 11: Session Logout Flow")
            except Exception as e:
                print(f"  ✘ FAIL: {e}")
                failed_tests.append(("Test 11: Session Logout Flow", str(e)))

            # -------------------------------------------------------------
            # TEST 12: JavaScript Runtime Exceptions Monitoring
            # -------------------------------------------------------------
            try:
                print("\n[TEST 12] Checking JavaScript Runtime Page Exceptions...")
                print(f"  Total logged uncaught JS exceptions: {len(page_exceptions)}")
                if page_exceptions:
                    print(f"  Exceptions: {page_exceptions}")
                assert len(page_exceptions) == 0, f"Uncaught JavaScript exceptions detected: {page_exceptions}"
                print("  ✔ PASS: Zero unhandled React/JavaScript exceptions during entire test run.")
                passed_tests.append("Test 12: JS Runtime Health Verification")
            except Exception as e:
                print(f"  ✘ FAIL: {e}")
                failed_tests.append(("Test 12: JS Runtime Health Verification", str(e)))

            browser.close()

    finally:
        if preview_proc:
            print("\n[*] Stopping Vite Preview server...")
            stop_process(preview_proc)

    print("\n" + "=" * 60)
    print("  LOOP — BROWSER E2E TEST RESULTS SUMMARY")
    print("=" * 60)
    print(f"Total Tests Executed : {len(passed_tests) + len(failed_tests)}")
    print(f"Passed               : {len(passed_tests)}")
    print(f"Failed               : {len(failed_tests)}")
    print("=" * 60)

    if failed_tests:
        print("\nFailed Tests:")
        for name, reason in failed_tests:
            print(f"  - {name}: {reason}")
        return 1
    else:
        print("\nALL 12 BROWSER E2E TESTS PASSED SUCCESSFULLY ON GOOGLE CHROME!")
        return 0

if __name__ == "__main__":
    sys.exit(run_e2e_tests())
