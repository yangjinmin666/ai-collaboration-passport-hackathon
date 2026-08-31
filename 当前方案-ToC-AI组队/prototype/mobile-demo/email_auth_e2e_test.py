"""Verify the mobile email-code login and masked account settings UI."""

import json
import os
import socket
import subprocess
import time
from pathlib import Path
from urllib.request import Request, urlopen

from playwright.sync_api import sync_playwright


HERE = Path(__file__).resolve().parent
BACKEND = HERE.parent.parent / "backend"


def free_port() -> int:
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        return listener.getsockname()[1]


def wait_for_url(url: str, process: subprocess.Popen[str]) -> None:
    deadline = time.time() + 8
    while time.time() < deadline:
        if process.poll() is not None:
            output = process.stdout.read() if process.stdout else ""
            raise RuntimeError(f"Service exited before ready: {url}\n{output}")
        try:
            with urlopen(url, timeout=1) as response:
                if response.status == 200:
                    return
        except Exception:
            time.sleep(0.1)
    raise RuntimeError(f"Service did not become ready: {url}")


def create_demo_session(backend_url: str, user_id: str) -> dict:
    request = Request(
        f"{backend_url}/api/auth/demo-sessions",
        data=json.dumps({"user_id": user_id}).encode(),
        headers={
            "content-type": "application/json",
            "x-demo-access-key": "browser-demo-access-key",
        },
        method="POST",
    )
    with urlopen(request, timeout=2) as response:
        return json.loads(response.read())


def main() -> None:
    backend_port = free_port()
    frontend_port = free_port()
    backend_url = f"http://127.0.0.1:{backend_port}"
    frontend_url = f"http://127.0.0.1:{frontend_port}"
    backend = subprocess.Popen(
        ["node", "test-support/email-live-server.js"],
        cwd=BACKEND,
        env={**os.environ, "PORT": str(backend_port)},
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
        wait_for_url(f"{backend_url}/health", backend)
        wait_for_url(frontend_url, frontend)
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page(
                viewport={"width": 390, "height": 844},
                is_mobile=True,
                has_touch=True,
            )
            page.goto(
                f"{frontend_url}/?variant=A&live=1&splash=0&apiBase={backend_url}"
            )
            page.get_by_role("heading", name="邮箱登录", exact=True).wait_for()
            page.get_by_label("邮箱", exact=True).fill("zhou@example.test")
            page.get_by_role("button", name="获取邮箱验证码").click()
            page.get_by_label("6 位验证码").fill("246810")
            page.get_by_role("button", name="验证并进入 COSPAN").click()
            page.locator(".live-login-card").wait_for(state="detached")
            page.get_by_role("button", name="我的", exact=True).click()
            page.get_by_text("周闻", exact=True).first.wait_for()
            page.get_by_role("button", name="打开设置").click()
            email_row = page.get_by_role("button", name="登录邮箱")
            email_row.wait_for()
            assert "z***u@example.test" in email_row.inner_text()
            assert page.locator("body").evaluate("el => el.scrollWidth <= innerWidth")

            lin_session = create_demo_session(backend_url, "user-lin")
            binding_context = browser.new_context(
                viewport={"width": 390, "height": 844},
                is_mobile=True,
                has_touch=True,
            )
            binding_values = json.dumps({
                "token": lin_session["access_token"],
                "expiresAt": lin_session["expires_at"],
                "apiBase": backend_url,
            })
            binding_context.add_init_script(script=f"""(() => {{
                const values = {binding_values};
                localStorage.setItem('rally_access_token', values.token);
                localStorage.setItem('rally_session_expires_at', values.expiresAt);
                localStorage.setItem('rally_api_base', values.apiBase);
            }})()""")
            binding_page = binding_context.new_page()
            binding_page.goto(f"{frontend_url}/?variant=A&live=1&splash=0&view=profile")
            binding_page.get_by_text("林澈", exact=True).first.wait_for()
            binding_page.get_by_role("button", name="打开设置").click()
            binding_page.get_by_role("button", name="登录邮箱").click()
            binding_page.get_by_label("邮箱", exact=True).fill("lin.owner@example.com")
            binding_page.get_by_role("button", name="发送验证码").click()
            binding_page.get_by_label("6 位验证码").fill("246810")
            binding_page.get_by_role("button", name="验证并绑定").click()
            bound_row = binding_page.get_by_role("button", name="登录邮箱")
            bound_row.wait_for()
            assert "l***r@example.com" in bound_row.inner_text()
            binding_context.close()
            browser.close()
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
