"""Run the real mobile geolocation flow against a real local RALLY API process."""

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


def free_port() -> int:
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        return listener.getsockname()[1]


def request_json(url: str, *, method: str = "GET", user_id: str | None = None, body=None):
    command = [
        "curl",
        "--silent",
        "--show-error",
        "--max-time",
        "2",
        "--request",
        method,
        "--write-out",
        "\n%{http_code}",
    ]
    if user_id:
        command.extend(["--header", f"x-demo-user-id: {user_id}"])
    if body is not None:
        command.extend([
            "--header",
            "content-type: application/json",
            "--data-binary",
            json.dumps(body),
        ])
    command.append(url)
    completed = subprocess.run(command, check=True, capture_output=True, text=True)
    raw, status = completed.stdout.rsplit("\n", 1)
    if not raw:
        payload = None
    else:
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = raw
    return int(status), payload


def wait_for_health(url: str, process=None):
    deadline = time.time() + 8
    last_error = None
    while time.time() < deadline:
        try:
            if request_json(url)[0] == 200:
                return
        except Exception as error:
            last_error = error
            if process is not None and process.poll() is not None:
                output = process.stdout.read() if process.stdout else ""
                raise RuntimeError(f"Service exited before ready: {url}\n{output}")
            time.sleep(0.1)
    if process is not None:
        process.terminate()
        output, _ = process.communicate(timeout=3)
        raise RuntimeError(f"Service did not become ready: {url}\n{output}\n{last_error!r}")
    raise RuntimeError(f"Service did not become ready: {url}\n{last_error!r}")


def main():
    backend_port = free_port()
    frontend_port = free_port()
    while frontend_port == backend_port:
        frontend_port = free_port()
    backend_url = f"http://127.0.0.1:{backend_port}"
    frontend_url = f"http://127.0.0.1:{frontend_port}"
    backend_env = {
        **os.environ,
        "PORT": str(backend_port),
        "HOST": "127.0.0.1",
        "DATABASE_PATH": ":memory:",
        "ALLOW_INSECURE_DEMO_AUTH": "1",
    }
    backend = subprocess.Popen(
        ["node", "src/server.js"],
        cwd=BACKEND,
        env=backend_env,
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
        status, _ = request_json(
            f"{backend_url}/api/events/hackathon-2026/profile",
            method="PATCH",
            user_id="user-lin",
            body={
                "role": "<img src=x onerror='window.__rallyXss=1'>",
                "status": "未组队",
                "skills": ["嵌入式", "IoT", "结构打样"],
                "interests": ["端侧 AI"],
                "availability": "今天可投入 8 小时",
                "collaboration_preferences": ["现场联调"],
                "collaboration_need": "寻找 AI / 后端搭档",
                "evidence": ["真实硬件项目"],
            },
        )
        assert status == 200
        status, _ = request_json(
            f"{backend_url}/api/events/hackathon-2026/presence",
            method="PUT",
            user_id="user-lin",
            body={"latitude": 31.23055, "longitude": 121.47382, "accuracy_m": 12},
        )
        assert status == 200
        status, _ = request_json(
            f"{backend_url}/api/me/platform-links/website",
            method="PUT",
            user_id="user-zhou",
            body={"url": "https://portfolio.example.com/zhou-wen"},
        )
        assert status == 200

        errors = []
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            context = browser.new_context(
                viewport={"width": 390, "height": 844},
                is_mobile=True,
                has_touch=True,
                geolocation={"latitude": 31.23040, "longitude": 121.47370, "accuracy": 10},
                permissions=["geolocation"],
            )
            page = context.new_page()
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(
                f"{frontend_url}/?variant=B&live=1"
                f"&apiBase={urllib.parse.quote(backend_url, safe=':/')}"
                "&demoUser=user-zhou",
            )
            page.get_by_text("● 真实定位已连接", exact=True).wait_for(timeout=8000)
            assert page.get_by_text("附近有 1 位协作者", exact=True).is_visible()
            assert page.get_by_text("林澈", exact=True).first.is_visible()
            assert page.locator('img[src="x"]').count() == 0
            assert page.evaluate("window.__rallyXss") is None

            page.locator('.app-nav [data-tab="profile"]').click()
            page.get_by_text("连接你的外部平台", exact=True).wait_for(timeout=4000)
            website_row = page.locator(
                '.platform-connect-row[data-platform="website"]'
            )
            assert website_row.locator("input").input_value() == (
                "https://portfolio.example.com/zhou-wen"
            )
            assert website_row.get_by_text(
                "✓ portfolio.example.com · 已保存", exact=True
            ).is_visible()
            assert website_row.locator("a").get_attribute("href") == (
                "https://portfolio.example.com/zhou-wen"
            )
            page.get_by_text("连接你的外部平台", exact=True).scroll_into_view_if_needed()
            page.screenshot(
                path=str(HERE / "artifacts" / "live-profile-platforms.png"),
                full_page=True,
            )
            page.once("dialog", lambda dialog: dialog.accept())
            page.locator('[data-action="remove-platform"][data-platform="website"]').click()
            page.wait_for_function(
                """() => document.querySelector(
                    '.platform-connect-row[data-platform="website"] input'
                )?.value === ''""",
                timeout=4000,
            )
            assert website_row.locator("input").input_value() == ""
            _, me = request_json(f"{backend_url}/api/me", user_id="user-zhou")
            assert me["platform_links"] == []

            website_input = website_row.locator("input")
            website_input.fill("https://portfolio.example.com/zhou-wen-v2")
            website_row.locator(".platform-save-button").click()
            page.get_by_text(
                "✓ portfolio.example.com · 已保存", exact=True
            ).wait_for(timeout=4000)
            _, me = request_json(f"{backend_url}/api/me", user_id="user-zhou")
            assert me["platform_links"][0]["url"] == (
                "https://portfolio.example.com/zhou-wen-v2"
            )

            page.locator('[data-action="toggle-visible"]').click()
            page.get_by_text("已暂停附近展示", exact=True).wait_for(timeout=4000)
            _, me = request_json(f"{backend_url}/api/me", user_id="user-zhou")
            event_profile = next(
                profile for profile in me["profiles"]
                if profile["event_id"] == "hackathon-2026"
            )
            assert event_profile["visibility"]["state"] == "PAUSED"
            _, nearby = request_json(
                f"{backend_url}/api/events/hackathon-2026/nearby",
                user_id="user-lin",
            )
            assert nearby["nearby"] == []

            page.locator('[data-action="toggle-visible"]').click()
            page.get_by_text("已恢复活动内可见", exact=True).wait_for(timeout=4000)
            page.locator('.app-nav [data-tab="discover"]').click()
            page.get_by_text("● 真实定位已连接", exact=True).wait_for(timeout=8000)

            page.goto(
                f"{frontend_url}/?variant=A&live=1"
                f"&apiBase={urllib.parse.quote(backend_url, safe=':/')}"
                "&demoUser=user-zhou",
            )
            time.sleep(0.4)
            _, nearby = request_json(
                f"{backend_url}/api/events/hackathon-2026/nearby",
                user_id="user-lin",
            )
            assert nearby["nearby"] == []
            assert errors == []

            token_requests = []
            token_page = context.new_page()
            token_page.add_init_script(
                "localStorage.setItem('rally_access_token', 'browser-secret-token')",
            )
            token_page.on(
                "request",
                lambda request: token_requests.append(request.url)
                if request.headers.get("authorization") == "Bearer browser-secret-token"
                else None,
            )
            token_page.goto(
                f"{frontend_url}/?variant=A&live=1"
                "&apiBase=https://attacker.invalid/collect",
            )
            token_page.get_by_text("RALLY", exact=True).first.wait_for(timeout=4000)
            assert token_requests
            assert all(url.startswith(frontend_url) for url in token_requests)
            assert all("attacker.invalid" not in url for url in token_requests)
            browser.close()

        print(json.dumps({
            "live_geolocation_connected": True,
            "real_backend_nearby_count": 1,
            "presence_removed_after_leaving": True,
            "visibility_pause_persisted": True,
            "platform_link_saved_rendered_and_removed": True,
            "live_profile_xss_blocked": True,
            "bearer_api_base_query_ignored": True,
            "browser_errors": errors,
        }, ensure_ascii=False, indent=2))
    finally:
        for process in (frontend, backend):
            process.terminate()
        for process in (frontend, backend):
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                process.kill()


if __name__ == "__main__":
    main()
