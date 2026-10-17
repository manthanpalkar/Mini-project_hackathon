"""
Verify PDF preview specifically for DBMS PROJECT Guidlines.pdf in real Chrome browser via Playwright.
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
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
VITE_PORT = 4178
BACKEND_PORT = 5058
FRONTEND_URL = f"http://127.0.0.1:{VITE_PORT}"
BACKEND_URL = f"http://127.0.0.1:{BACKEND_PORT}"

def wait_for_service(url, timeout_sec=25, name="Service"):
    start = time.time()
    while time.time() - start < timeout_sec:
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=2) as resp:
                if resp.status in (200, 304):
                    print(f"[+] {name} is UP at {url}")
                    return True
        except urllib.error.HTTPError as http_err:
            if http_err.code in (200, 304, 401, 403):
                print(f"[+] {name} is UP (HTTP {http_err.code}) at {url}")
                return True
        except Exception:
            pass
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

def main():
    print("=" * 70)
    print("VERIFYING PDF PREVIEW: DBMS PROJECT Guidlines.pdf")
    print("=" * 70)

    # Load Atlas MONGODB_URI from backend/.env
    env_vars = {}
    with open(os.path.join(BACKEND_DIR, '.env'), 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                env_vars[k.strip()] = v.strip()

    mongo_uri = env_vars.get("MONGODB_URI")
    jwt_secret = env_vars.get("JWT_SECRET", "spit_loop_super_secret_jwt_key_2026")

    print(f"[*] Target MongoDB: {mongo_uri[:35]}...")

    # Start Backend
    print(f"[*] Launching backend server on port {BACKEND_PORT}...")
    backend_env = os.environ.copy()
    backend_env["PORT"] = str(BACKEND_PORT)
    backend_env["MONGODB_URI"] = mongo_uri
    backend_env["JWT_SECRET"] = jwt_secret
    backend_env["NODE_ENV"] = "test"
    backend_proc = subprocess.Popen(
        ["node", "server.js"],
        cwd=BACKEND_DIR,
        env=backend_env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        preexec_fn=os.setsid
    )

    # Start Frontend Preview
    print(f"[*] Launching Vite preview on port {VITE_PORT}...")
    frontend_env = os.environ.copy()
    frontend_env["VITE_API_URL"] = f"{BACKEND_URL}/api"
    frontend_env["VITE_PROXY_TARGET"] = f"http://127.0.0.1:{BACKEND_PORT}"
    frontend_proc = subprocess.Popen(
        ["npm", "run", "preview", "--", "--port", str(VITE_PORT), "--host", "127.0.0.1"],
        cwd=FRONTEND_DIR,
        env=frontend_env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        preexec_fn=os.setsid
    )

    try:
        if not wait_for_service(f"{BACKEND_URL}/api/health", timeout_sec=20, name="Backend API"):
            raise RuntimeError("Backend failed to start.")
        # Ensure MongoDB connection is fully connected (readyState === 1)
        time.sleep(1.5)
        if not wait_for_service(f"{BACKEND_URL}/api/resources", timeout_sec=25, name="Backend MongoDB Connection"):
            raise RuntimeError("Backend database failed to connect.")
        if not wait_for_service(FRONTEND_URL, timeout_sec=20, name="Vite Frontend Preview"):
            raise RuntimeError("Frontend preview failed to start.")

        print("\n[*] Starting Playwright Chrome session...")
        import jwt
        token = jwt.encode({
            "email": "pruthviraj.kanase25@spit.ac.in",
            "name": "Pruthviraj",
            "role": "Student",
            "status": "Active",
            "iat": int(time.time()),
            "exp": int(time.time()) + 86400
        }, jwt_secret, algorithm="HS256")

        session_payload = {
            "email": "pruthviraj.kanase25@spit.ac.in",
            "name": "Pruthviraj",
            "role": "Student",
            "status": "Active",
            "username": "pruthviraj",
            "onboarded": True,
            "isAdmin": False,
            "token": token
        }

        with sync_playwright() as p:
            browser = p.chromium.launch(channel="chrome", headless=True)
            context = browser.new_context(viewport={"width": 1280, "height": 840})
            context.add_init_script(f"""
                localStorage.setItem('loop_current_user', JSON.stringify({json.dumps(session_payload)}));
            """)
            page = context.new_page()

            console_logs = []
            page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
            page.on("pageerror", lambda err: console_logs.append(f"[pageerror] {err}"))

            print("[*] Establishing authenticated session on /home...")
            page.goto(f"{FRONTEND_URL}/home", wait_until="networkidle")
            page.wait_for_timeout(1000)
            print(f"[+] Loaded URL: {page.url}")

            print("[*] Navigating to /preview/1792231573193 (DBMS PROJECT Guidlines.pdf)...")
            page.goto(f"{FRONTEND_URL}/preview/1792231573193", wait_until="networkidle")
            page.wait_for_timeout(3000)
            print(f"[+] Current URL after preview navigation: {page.url}")

            if console_logs:
                print("[*] Console logs so far:")
                for log in console_logs:
                    print("   ", log)

            # Check header
            page.wait_for_selector("header", timeout=10000)
            header_text = page.locator("header").inner_text()
            print(f"[+] Header text: {header_text.replace(chr(10), ' | ')}")
            assert "DBMS PROJECT Guidlines.pdf" in header_text, "Filename must appear in header"

            # Check for error state
            error_el = page.locator("text=Preview Unavailable")
            if error_el.count() > 0:
                print("[-] FAIL: Preview Unavailable was shown!")
                for log in console_logs:
                    print("   ", log)
                sys.exit(1)

            print("[+] SUCCESS: 'Preview Unavailable' is NOT displayed!")

            # Check for Canvas or Iframe
            canvas_count = page.locator("canvas").count()
            iframe_count = page.locator("iframe").count()
            print(f"[+] Render elements found: canvas={canvas_count}, iframe={iframe_count}")
            assert canvas_count > 0 or iframe_count > 0, "Either Canvas or Native PDF iframe must be rendered"

            # Check canvas visibility if canvas is present
            if canvas_count > 0:
                canvas = page.locator("canvas").first
                is_visible = canvas.is_visible()
                box = canvas.bounding_box()
                print(f"[+] Canvas visible: {is_visible}, dimensions: {box}")
                assert is_visible and box and box["width"] > 100 and box["height"] > 100, "Canvas must have real width/height"

            # Test Next Page flip (Page 1 -> Page 2)
            print("[*] Testing page flip (1 / 6 -> 2 / 6)...")
            next_page_btn = page.locator('button[title*="Next Page"]')
            if next_page_btn.count() > 0:
                next_page_btn.first.click()
                page.wait_for_timeout(1000)
                header_p2 = page.locator("header").inner_text()
                print(f"[+] Header text after page flip: {header_p2.replace(chr(10), ' | ')}")
                assert "2 / 6" in header_p2, "Header must show Page 2 / 6"
                print("  ✔ Page flip 1 -> 2 succeeded!")

            # Test Zoom In
            print("[*] Testing zoom in...")
            zoom_in_btn = page.locator('button[title*="Zoom In"]')
            if zoom_in_btn.count() > 0:
                zoom_in_btn.first.click()
                page.wait_for_timeout(500)
                header_zoom = page.locator("header").inner_text()
                print(f"[+] Header text after zoom: {header_zoom.replace(chr(10), ' | ')}")
                assert "115%" in header_zoom, "Zoom level must increase to 115%"
                print("  ✔ Zoom in succeeded!")

            # Test Native Viewer Switch
            print("[*] Testing toggle to Browser Native PDF Viewer...")
            native_toggle_btn = page.locator('button:has-text("Open in Browser Native Viewer")')
            if native_toggle_btn.count() > 0:
                native_toggle_btn.first.click()
                page.wait_for_timeout(1000)
                iframe = page.locator("iframe")
                assert iframe.count() > 0, "Native PDF iframe must be rendered"
                print("  ✔ Successfully switched to Native Browser PDF Viewer iframe!")

            # Take verification screenshot
            screenshot_path = os.path.join(BACKEND_DIR, "dbms_pdf_preview_verified.png")
            page.screenshot(path=screenshot_path)
            print(f"[+] Screenshot saved to {screenshot_path}")

            browser.close()

        print("\n" + "=" * 70)
        print("✔ ALL TESTS PASSED: PDF PREVIEW IS FULLY WORKING!")
        print("=" * 70)

    finally:
        stop_process(backend_proc)
        stop_process(frontend_proc)

if __name__ == '__main__':
    main()
