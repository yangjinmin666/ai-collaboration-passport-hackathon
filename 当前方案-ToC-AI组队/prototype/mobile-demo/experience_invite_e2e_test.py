"""Verify that a signed experience-group link creates a real mobile session."""

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
INVITE_SECRET = "e2e-experience-invite-secret-with-at-least-32-characters"


def free_port() -> int:
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        return listener.getsockname()[1]


def wait_for(url: str, process: subprocess.Popen) -> None:
    deadline = time.time() + 8
    while time.time() < deadline:
        try:
            if subprocess.run(
                ["curl", "--silent", "--fail", "--max-time", "1", url],
                check=False,
                capture_output=True,
            ).returncode == 0:
                return
        except OSError:
            pass
        if process.poll() is not None:
            output = process.stdout.read() if process.stdout else ""
            raise RuntimeError(f"Service exited before ready: {output}")
        time.sleep(0.1)
    raise RuntimeError(f"Service did not become ready: {url}")


def create_token() -> str:
    program = """
      import { createExperienceInviteToken } from './src/experience-invite.js';
      process.stdout.write(createExperienceInviteToken({
        secret: process.env.EXPERIENCE_INVITE_SECRET,
        campaignId: 'browser-e2e',
        eventId: 'hackathon-2026',
        maxUses: 3,
        expiresAt: new Date(Date.now() + 3600000),
      }));
    """
    completed = subprocess.run(
        ["node", "--input-type=module", "--eval", program],
        cwd=BACKEND,
        env={**os.environ, "EXPERIENCE_INVITE_SECRET": INVITE_SECRET},
        check=True,
        capture_output=True,
        text=True,
    )
    return completed.stdout


def main() -> None:
    backend_port = free_port()
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
            "EXPERIENCE_INVITE_SECRET": INVITE_SECRET,
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
        wait_for(f"{backend_url}/health", backend)
        wait_for(frontend_url, frontend)
        token = create_token()
        url = (
            f"{frontend_url}/?live=1"
            f"&apiBase={urllib.parse.quote(backend_url, safe=':/')}"
            f"&experience_invite={urllib.parse.quote(token, safe='')}"
        )
        errors = []
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            context = browser.new_context(viewport={"width": 390, "height": 844})
            page = context.new_page()
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(url)
            page.locator('[data-onboarding-step="0"]').wait_for(timeout=8000)
            assert "experience_invite" not in page.url
            assert page.locator("[data-live-otp-request]").count() == 0
            access_token = page.evaluate("localStorage.getItem('rally_access_token')")
            assert access_token and len(access_token) >= 40
            me = page.evaluate(
                """async ({baseUrl, token}) => {
                    const response = await fetch(`${baseUrl}/api/me`, {
                      headers: {authorization: `Bearer ${token}`},
                    });
                    return {status: response.status, body: await response.json()};
                }""",
                {"baseUrl": backend_url, "token": access_token},
            )
            assert me["status"] == 200
            assert me["body"]["user"]["display_name"] == "COSPAN 新朋友"
            browser.close()
        assert not errors, json.dumps(errors, ensure_ascii=False)
        print(json.dumps({"experience_invite_login": True}, ensure_ascii=False))
    finally:
        for process in (frontend, backend):
            process.terminate()
            try:
                process.communicate(timeout=3)
            except subprocess.TimeoutExpired:
                process.kill()
                process.communicate(timeout=3)


if __name__ == "__main__":
    main()
