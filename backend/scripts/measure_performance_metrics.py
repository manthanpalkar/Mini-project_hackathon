"""
LOOP — Real Browser Performance & Network Metrics Measurement Script
Uses Playwright with Chromium/Google Chrome to measure real network transfers,
request counts, API payload sizes, navigation times, and PDF rendering times.
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
VITE_PORT = 4180
BACKEND_PORT = 5060
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

def measure_all():
    print("=" * 70)
    print("LOOP PERFORMANCE & NETWORK BENCHMARK HARNESS")
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

    # Start Backend
    print(f"[*] Starting Backend on port {BACKEND_PORT}...")
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
    print(f"[*] Starting Frontend Vite Preview on port {VITE_PORT}...")
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

    metrics = {}

    try:
        if not wait_for_service(f"{BACKEND_URL}/api/health", timeout_sec=20, name="Backend API"):
            raise RuntimeError("Backend failed to start.")
        time.sleep(1.5)
        if not wait_for_service(f"{BACKEND_URL}/api/resources", timeout_sec=25, name="Backend MongoDB Connection"):
            raise RuntimeError("Backend database failed to connect.")
        if not wait_for_service(FRONTEND_URL, timeout_sec=20, name="Frontend Preview"):
            raise RuntimeError("Frontend failed to start.")

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

            console_errors = []
            page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
            page.on("pageerror", lambda err: console_errors.append(str(err)))

            # Track network requests
            request_log = []
            page.on("request", lambda req: request_log.append({
                "url": req.url,
                "method": req.method,
                "resource_type": req.resource_type,
                "timestamp": time.time()
            }))

            failed_requests = []
            response_sizes = {}
            def on_response(res):
                try:
                    body = res.body()
                    sz = len(body)
                    response_sizes[res.url] = sz
                except Exception:
                    sz = 0
                    response_sizes[res.url] = 0
                if res.status >= 400:
                    failed_requests.append({"url": res.url, "status": res.status})

            page.on("response", on_response)

            # Test 1: Initial Login Page Load (Cold and Warm)
            print("\n[Metric 1] Measuring Unauthenticated Load on /login (Cold & Warm)...")
            unauth_page = context.new_page()
            login_reqs = []
            unauth_page.on("request", lambda r: login_reqs.append(r.url))
            start_login = time.time()
            unauth_page.goto(f"{FRONTEND_URL}/login", wait_until="networkidle")
            login_time = (time.time() - start_login) * 1000

            # Warm load measurement
            start_warm_login = time.time()
            unauth_page.reload(wait_until="networkidle")
            login_warm_time = (time.time() - start_warm_login) * 1000

            metrics["initial_login_requests"] = len(login_reqs)
            metrics["initial_login_load_ms"] = round(login_time, 1)
            metrics["login_warm_load_ms"] = round(login_warm_time, 1)
            pdf_on_login = any("pdf" in u.lower() for u in login_reqs)
            metrics["pdfjs_loaded_on_login"] = pdf_on_login
            print(f"  ✔ Login cold load time: {login_time:.1f} ms")
            print(f"  ✔ Login warm load time: {login_warm_time:.1f} ms")
            print(f"  ✔ Login page requests: {len(login_reqs)}")
            print(f"  ✔ PDF.js loaded on login: {pdf_on_login} (Strictly Isolated: {'YES' if not pdf_on_login else 'NO'})")
            unauth_page.close()

            # Test 2: Authenticated /home page load (3 runs for median)
            print("\n[Metric 2] Measuring Authenticated /home Navigation (3 runs)...")
            home_times = []
            home_req_counts = []
            for r in range(3):
                req_start_idx = len(request_log)
                start_home = time.time()
                page.goto(f"{FRONTEND_URL}/home", wait_until="networkidle")
                elapsed = (time.time() - start_home) * 1000
                home_times.append(elapsed)
                home_req_counts.append(len(request_log) - req_start_idx)
                time.sleep(0.3)

            import statistics
            median_home_time = statistics.median(home_times)
            metrics["home_navigation_runs_ms"] = [round(t, 1) for t in home_times]
            metrics["home_navigation_ms"] = round(median_home_time, 1)
            metrics["home_request_count"] = home_req_counts[0]
            print(f"  ✔ /home navigation median: {median_home_time:.1f} ms (runs: {[round(t, 1) for t in home_times]})")
            print(f"  ✔ /home request count: {home_req_counts[0]}")

            # Test 3: Stories page navigation and payload size (3 runs)
            print("\n[Metric 3] Measuring Stories Page Navigation & API Payload (3 runs)...")
            stories_times = []
            stories_req_counts = []
            for r in range(3):
                req_start_idx = len(request_log)
                start_stories = time.time()
                page.goto(f"{FRONTEND_URL}/stories", wait_until="networkidle")
                page.wait_for_timeout(500)
                elapsed = (time.time() - start_stories) * 1000
                stories_times.append(elapsed)
                stories_req_counts.append(len(request_log) - req_start_idx)
                time.sleep(0.3)

            median_stories_time = statistics.median(stories_times)
            stories_reqs = request_log[-stories_req_counts[-1]:]
            api_stories_reqs = [req["url"] for req in stories_reqs if "/api/stories" in req["url"]]
            duplicate_stories = len(api_stories_reqs) - len(set(api_stories_reqs))

            stories_payload_size = 0
            for url, size in response_sizes.items():
                if "/api/stories" in url:
                    stories_payload_size = size
                    break

            metrics["stories_navigation_runs_ms"] = [round(t, 1) for t in stories_times]
            metrics["stories_navigation_ms"] = round(median_stories_time, 1)
            metrics["stories_request_count"] = stories_req_counts[0]
            metrics["stories_api_payload_bytes"] = stories_payload_size
            metrics["stories_duplicate_api_calls"] = duplicate_stories
            print(f"  ✔ Stories navigation median: {median_stories_time:.1f} ms (runs: {[round(t, 1) for t in stories_times]})")
            print(f"  ✔ Stories API payload size: {stories_payload_size} bytes ({stories_payload_size / 1024:.1f} KB)")
            print(f"  ✔ Duplicate API calls: {duplicate_stories}")

            # Test 4: Resources page navigation and binary isolation (3 runs)
            print("\n[Metric 4] Measuring Resources Page Navigation & Payload (3 runs)...")
            resources_times = []
            resources_req_counts = []
            for r in range(3):
                req_start_idx = len(request_log)
                start_resources = time.time()
                page.goto(f"{FRONTEND_URL}/resources", wait_until="networkidle")
                page.wait_for_timeout(500)
                elapsed = (time.time() - start_resources) * 1000
                resources_times.append(elapsed)
                resources_req_counts.append(len(request_log) - req_start_idx)
                time.sleep(0.3)

            median_resources_time = statistics.median(resources_times)
            resources_reqs = request_log[-resources_req_counts[-1]:]
            resource_file_downloads = [req["url"] for req in resources_reqs if "/file" in req["url"] or ".pdf" in req["url"]]

            resources_payload_size = 0
            for url, size in response_sizes.items():
                if "/api/resources" in url and not url.endswith("/file"):
                    resources_payload_size = size
                    break

            metrics["resources_navigation_runs_ms"] = [round(t, 1) for t in resources_times]
            metrics["resources_navigation_ms"] = round(median_resources_time, 1)
            metrics["resources_request_count"] = resources_req_counts[0]
            metrics["resources_api_payload_bytes"] = resources_payload_size
            metrics["resource_file_binaries_downloaded_on_list"] = len(resource_file_downloads)
            print(f"  ✔ Resources navigation median: {median_resources_time:.1f} ms (runs: {[round(t, 1) for t in resources_times]})")
            print(f"  ✔ Resources API payload size: {resources_payload_size} bytes ({resources_payload_size / 1024:.1f} KB)")
            print(f"  ✔ Resource file binaries eagerly downloaded: {len(resource_file_downloads)} (Should be 0)")

            # Test 5: PDF Preview Loading & Canvas Rendering Time
            print("\n[Metric 5] Measuring PDF Preview Rendering Time & Canvas Dimensions...")
            start_preview = time.time()
            page.goto(f"{FRONTEND_URL}/preview/1792231573193", wait_until="networkidle")
            page.wait_for_selector("canvas", timeout=12000)
            preview_render_time = (time.time() - start_preview) * 1000

            canvas = page.locator("canvas").first
            canvas_box = canvas.bounding_box()

            total_transferred = sum(response_sizes.values())
            metrics["pdf_preview_time_to_canvas_ms"] = round(preview_render_time, 1)
            metrics["canvas_width"] = round(canvas_box["width"] if canvas_box else 0, 1)
            metrics["canvas_height"] = round(canvas_box["height"] if canvas_box else 0, 1)
            metrics["total_transferred_bytes"] = total_transferred
            metrics["failed_network_requests"] = len(failed_requests)
            metrics["console_errors"] = len(console_errors)
            print(f"  ✔ PDF Preview time to first page canvas: {preview_render_time:.1f} ms")
            print(f"  ✔ Canvas dimensions: {canvas_box['width']:.1f} x {canvas_box['height']:.1f}")
            print(f"  ✔ Total transferred bytes across profile: {total_transferred} bytes ({total_transferred / 1024:.1f} KB)")
            print(f"  ✔ Failed network requests: {len(failed_requests)}")
            print(f"  ✔ Total console errors encountered: {len(console_errors)}")

            browser.close()

        print("\n" + "=" * 70)
        print("MEASURED PERFORMANCE SUMMARY:")
        print("=" * 70)
        for k, v in metrics.items():
            print(f"  {k}: {v}")

        # Save metrics JSON to backend/performance_metrics.json
        out_path = os.path.join(BACKEND_DIR, 'performance_metrics.json')
        with open(out_path, 'w') as f:
            json.dump(metrics, f, indent=2)
        print(f"\n[+] Metrics saved to: {out_path}\n")

        return 0

    finally:
        print("[*] Tearing down benchmark services...")
        stop_process(backend_proc)
        stop_process(frontend_proc)

if __name__ == "__main__":
    sys.exit(measure_all())
