"""Verify browser exposure events reach the real first-party analytics API."""

import json
import os
import socket
import subprocess
import time
import urllib.parse
from pathlib import Path

from playwright.sync_api import sync_playwright


HERE = Path(__file__).resolve().parent
BACKEND = HERE.parent.parent / "backend"
ADMIN_TOKEN = "browser-analytics-admin-token-000000000000000000000000"


def free_port() -> int:
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        return listener.getsockname()[1]


def wait_for_health(url: str, process: subprocess.Popen):
    deadline = time.time() + 8
    while time.time() < deadline:
        completed = subprocess.run(
            ["curl", "--fail", "--silent", "--max-time", "1", url],
            capture_output=True,
            text=True,
        )
        if completed.returncode == 0:
            return
        if process.poll() is not None:
            output = process.stdout.read() if process.stdout else ""
            raise RuntimeError(f"Service exited before ready: {url}\n{output}")
        time.sleep(0.1)
    raise RuntimeError(f"Service did not become ready: {url}")


def analytics_summary(backend_url: str):
    completed = subprocess.run(
        [
            "curl",
            "--fail",
            "--silent",
            "--max-time",
            "3",
            "--header",
            f"x-analytics-admin-token: {ADMIN_TOKEN}",
            f"{backend_url}/api/admin/analytics/summary?exhibition_id=hackathon-2026",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(completed.stdout)


def main():
    backend_port = free_port()
    frontend_port = free_port()
    while frontend_port == backend_port:
        frontend_port = free_port()
    backend_url = f"http://127.0.0.1:{backend_port}"
    frontend_url = f"http://127.0.0.1:{frontend_port}"
    backend = subprocess.Popen(
        ["node", "src/server.js"],
        cwd=BACKEND,
        env={
            **os.environ,
            "PORT": str(backend_port),
            "HOST": "127.0.0.1",
            "DATABASE_PATH": ":memory:",
            "ALLOW_INSECURE_DEMO_AUTH": "1",
            "ANALYTICS_ADMIN_TOKEN": ADMIN_TOKEN,
            "RALLY_APP_VERSION": "browser-e2e",
        },
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    frontend = subprocess.Popen(
        ["python3", "-m", "http.server", str(frontend_port), "--bind", "127.0.0.1"],
        cwd=HERE,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    try:
        wait_for_health(f"{backend_url}/health", backend)
        wait_for_health(frontend_url, frontend)
        errors = []
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            context = browser.new_context(
                viewport={"width": 390, "height": 844},
                is_mobile=True,
                has_touch=True,
            )
            page = context.new_page()
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(
                f"{frontend_url}/?variant=A&live=1"
                f"&apiBase={urllib.parse.quote(backend_url, safe=':/')}",
            )
            privacy_notice = page.locator("[data-analytics-privacy-notice]")
            privacy_notice.wait_for(timeout=4000)
            privacy_copy = privacy_notice.inner_text()
            assert "改进登录、发现和组队体验" in privacy_copy
            assert "页面浏览与关键协作结果" in privacy_copy
            assert "30 天" in privacy_copy
            assert "现场工作人员" in privacy_copy and "删除" in privacy_copy

            page.goto(
                f"{frontend_url}/?variant=A&live=1"
                f"&apiBase={urllib.parse.quote(backend_url, safe=':/')}"
                "&demoUser=user-zhou",
            )
            page.locator(".recommendation-card-active").wait_for(timeout=8000)
            page.wait_for_timeout(1300)
            page.locator('[data-action="open-person"]').click()
            page.locator(".person-overlay").wait_for(timeout=4000)
            page.wait_for_timeout(500)
            browser.close()

        deadline = time.time() + 4
        counts = {}
        while time.time() < deadline:
            summary = analytics_summary(backend_url)
            counts = {
                item["event_name"]: item["total"]
                for item in summary["event_counts"]
            }
            if all(counts.get(name, 0) >= 1 for name in (
                "discovery_viewed",
                "match_impression",
                "match_detail_opened",
            )):
                break
            time.sleep(0.1)
        assert counts.get("discovery_viewed", 0) >= 1, counts
        assert counts.get("match_impression", 0) >= 1, counts
        assert counts.get("match_detail_opened", 0) >= 1, counts
        assert errors == [], errors
        print(json.dumps({
            "browser_analytics_received": True,
            "login_privacy_notice_complete": True,
            "event_counts": counts,
            "browser_errors": errors,
        }, ensure_ascii=False, indent=2))
    finally:
        for process in (frontend, backend):
            process.terminate()
        for process in (frontend, backend):
            try:
                process.communicate(timeout=3)
            except subprocess.TimeoutExpired:
                process.kill()
                process.communicate(timeout=3)


if __name__ == "__main__":
    main()
