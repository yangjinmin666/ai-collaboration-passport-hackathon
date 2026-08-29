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
        "DEMO_ACCESS_KEY": "browser-demo-access-key",
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
            presence_requests = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on(
                "request",
                lambda request: presence_requests.append(request.method)
                if "/presence" in request.url
                else None,
            )
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

            page.locator('[data-action="open-profile-editor"]').click()
            profile_form = page.locator("[data-live-profile-form]")
            profile_form.locator('input[name="role"]').fill("AI 产品与后端")
            profile_form.locator('select[name="status"]').select_option("团队缺人")
            profile_form.locator('input[name="skills"]').fill("Agent，产品架构，后端")
            profile_form.locator('input[name="interests"]').fill("现场协作，可信 AI")
            profile_form.locator('input[name="availability"]').fill("今天可持续投入 6 小时")
            profile_form.locator('input[name="preferences"]').fill("快速原型，异步记录")
            profile_form.locator('textarea[name="need"]').fill("寻找硬件搭档完成真机闭环")
            profile_form.locator('textarea[name="evidence"]').fill("RALLY Live API\n双设备协作 E2E")
            profile_form.locator(
                'input[name="public-fields"][value="evidence"]'
            ).uncheck()
            assert "能力证据" not in profile_form.locator(
                "[data-public-fields-preview]"
            ).inner_text()
            profile_form.get_by_role(
                "button", name="保存资料与公开范围"
            ).click()
            page.get_by_text("协作资料与公开范围已保存", exact=True).wait_for(
                timeout=5000
            )
            _, me = request_json(f"{backend_url}/api/me", user_id="user-zhou")
            event_profile = next(
                profile for profile in me["profiles"]
                if profile["event_id"] == "hackathon-2026"
            )
            assert event_profile["role"] == "AI 产品与后端"
            assert event_profile["status"] == "团队缺人"
            assert event_profile["skills"] == ["Agent", "产品架构", "后端"]
            assert event_profile["evidence"] == ["RALLY Live API", "双设备协作 E2E"]
            assert "evidence" not in event_profile["visibility"]["public_fields"]

            page.reload()
            page.locator('.app-nav [data-tab="profile"]').wait_for(timeout=8000)
            page.locator('.app-nav [data-tab="profile"]').click()
            page.locator('[data-action="open-profile-editor"]').click()
            profile_form = page.locator("[data-live-profile-form]")
            assert profile_form.locator('input[name="role"]').input_value() == (
                "AI 产品与后端"
            )
            assert not profile_form.locator(
                'input[name="public-fields"][value="evidence"]'
            ).is_checked()
            page.locator(
                '.profile-settings-head [data-action="close-profile-editor"]'
            ).click()

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
            assert nearby["nearby"] == [], presence_requests

            page.locator('[data-action="toggle-visible"]').click()
            page.get_by_text("已恢复展会内可见", exact=True).wait_for(timeout=4000)
            page.locator('.app-nav [data-tab="discover"]').click()
            page.get_by_text("● 真实定位已连接", exact=True).wait_for(timeout=8000)

            page.goto(
                f"{frontend_url}/?variant=A&live=1"
                f"&apiBase={urllib.parse.quote(backend_url, safe=':/')}"
                "&demoUser=user-zhou",
            )
            deadline = time.time() + 3
            nearby = {"nearby": ["pending"]}
            while time.time() < deadline and nearby["nearby"]:
                _, nearby = request_json(
                    f"{backend_url}/api/events/hackathon-2026/nearby",
                    user_id="user-lin",
                )
                if nearby["nearby"]:
                    time.sleep(0.1)
            assert nearby["nearby"] == [], presence_requests
            assert presence_requests[-1] == "DELETE", presence_requests
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

            untrusted_context = browser.new_context(
                viewport={"width": 390, "height": 844},
                is_mobile=True,
                has_touch=True,
            )
            untrusted_page = untrusted_context.new_page()
            login_requests = []
            untrusted_page.on(
                "request",
                lambda request: login_requests.append(request.url)
                if "/api/auth/demo-sessions" in request.url
                else None,
            )
            untrusted_page.goto(
                f"{frontend_url}/?variant=A&live=1"
                "&apiBase=https://attacker.invalid/collect",
            )
            untrusted_page.get_by_label("RALLY 账号").fill("user-zhou")
            untrusted_page.get_by_label("现场访问码").fill("must-not-leak")
            untrusted_page.get_by_role("button", name="登录 RALLY").click()
            untrusted_page.wait_for_timeout(500)
            assert login_requests
            assert all(url.startswith(frontend_url) for url in login_requests)
            assert all("attacker.invalid" not in url for url in login_requests)
            untrusted_context.close()

            xss_context = browser.new_context(
                viewport={"width": 390, "height": 844},
                is_mobile=True,
                has_touch=True,
            )
            xss_page = xss_context.new_page()

            def mock_live_inboxes(route):
                parsed = urllib.parse.urlparse(route.request.url)
                query = urllib.parse.parse_qs(parsed.query)
                direction = query.get("direction", [""])[0]
                if parsed.path == "/api/connections/requests" and direction == "incoming":
                    route.fulfill(
                        status=200,
                        content_type="application/json",
                        body=json.dumps({"requests": [{
                            "id": "request-xss",
                            "direction": "incoming",
                            "status": "REQUESTED",
                            "source": "link",
                            "message": "<img src=x onerror='window.__rallyInboxXss=1'>",
                            "connection_id": None,
                            "counterpart": {
                                "id": "user-lin",
                                "display_name": "<img src=x onerror='window.__rallyInboxXss=2'>",
                                "avatar": "memoji-4",
                                "role": "硬件构建者",
                                "status": "未组队",
                            },
                        }]}),
                    )
                    return
                if parsed.path == "/api/team-invitations" and direction == "incoming":
                    route.fulfill(
                        status=200,
                        content_type="application/json",
                        body=json.dumps({"invitations": [{
                            "id": "invitation-xss",
                            "direction": "incoming",
                            "status": "PENDING",
                            "project": {
                                "id": "project-xss",
                                "title": "<img src=x onerror='window.__rallyInboxXss=3'>",
                                "summary": "test",
                                "status": "FORMING",
                            },
                            "counterpart": {
                                "id": "user-lin",
                                "display_name": "<img src=x onerror='window.__rallyInboxXss=4'>",
                                "avatar": "memoji-4",
                            },
                            "role_need": {
                                "id": "role-xss",
                                "title": "<img src=x onerror='window.__rallyInboxXss=5'>",
                                "skills": [],
                            },
                        }]}),
                    )
                    return
                route.continue_()

            xss_page.route("**/api/**", mock_live_inboxes)
            xss_page.goto(
                f"{frontend_url}/?variant=A&live=1"
                f"&apiBase={urllib.parse.quote(backend_url, safe=':/')}"
                "&demoUser=user-zhou",
            )
            xss_page.locator(".app-nav").wait_for(timeout=8000)
            xss_page.locator('.app-nav [data-tab="connections"]').click()
            xss_page.get_by_text("想认识你", exact=True).wait_for(timeout=4000)
            assert xss_page.locator('img[src="x"]').count() == 0
            xss_page.locator('.app-nav [data-tab="collaboration"]').click()
            xss_page.get_by_text("入队邀请", exact=True).wait_for(timeout=4000)
            assert xss_page.locator('img[src="x"]').count() == 0
            assert xss_page.evaluate("window.__rallyInboxXss") is None
            xss_context.close()

            expiry_context = browser.new_context(
                viewport={"width": 390, "height": 844},
                is_mobile=True,
                has_touch=True,
            )
            expiry_page = expiry_context.new_page()
            expiry_page.on(
                "pageerror", lambda error: errors.append(f"expiry:{error}")
            )
            expiry_page.goto(
                f"{frontend_url}/?variant=A&live=1"
                f"&apiBase={urllib.parse.quote(backend_url, safe=':/')}"
                "&demoUser=user-zhou",
            )
            expiry_page.locator(".recommendation-card-active").wait_for(
                timeout=8000
            )
            expiry_page.locator(".recommendation-card-active").click()
            expiry_page.route(
                "**/api/events/hackathon-2026/discover",
                lambda route: route.fulfill(
                    status=401,
                    content_type="application/json",
                    body=json.dumps({
                        "error": {
                            "code": "AUTH_REQUIRED",
                            "message": "A valid session is required.",
                        }
                    }),
                ),
            )
            expiry_page.get_by_text("登录后进入现场", exact=True).wait_for(
                timeout=6000
            )
            assert expiry_page.locator(".overlay").count() == 0
            assert "overlay" not in urllib.parse.parse_qs(
                urllib.parse.urlparse(expiry_page.url).query
            )
            expiry_context.close()

            sync_context = browser.new_context(
                viewport={"width": 390, "height": 844},
                is_mobile=True,
                has_touch=True,
            )
            sync_page = sync_context.new_page()
            sync_page.route(
                "**/api/events/hackathon-2026/discover",
                lambda route: route.fulfill(
                    status=503,
                    content_type="application/json",
                    body=json.dumps({
                        "error": {
                            "code": "UNAVAILABLE",
                            "message": "Discover temporarily unavailable",
                        }
                    }),
                ),
            )
            sync_page.goto(
                f"{frontend_url}/?variant=A&live=1"
                f"&apiBase={urllib.parse.quote(backend_url, safe=':/')}"
                "&demoUser=user-zhou",
            )
            sync_page.get_by_text("现场成员暂时无法同步", exact=True).wait_for(
                timeout=8000
            )
            assert sync_page.get_by_role("button", name="重新连接").is_visible()
            sync_context.close()

            def login_live(live_page, user_id):
                live_page.goto(
                    f"{frontend_url}/?variant=A&live=1"
                    f"&apiBase={urllib.parse.quote(backend_url, safe=':/')}",
                )
                live_page.get_by_label("RALLY 账号").fill(user_id)
                live_page.get_by_label("现场访问码").fill("browser-demo-access-key")
                live_page.get_by_role("button", name="登录 RALLY").click()
                live_page.locator(".app-nav").wait_for(timeout=8000)

            zhou_context = browser.new_context(
                viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True
            )
            lin_context = browser.new_context(
                viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True
            )
            zhou_page = zhou_context.new_page()
            lin_page = lin_context.new_page()
            zhou_page.on("pageerror", lambda error: errors.append(f"zhou:{error}"))
            lin_page.on("pageerror", lambda error: errors.append(f"lin:{error}"))
            login_live(zhou_page, "user-zhou")
            login_live(lin_page, "user-lin")

            zhou_page.get_by_role("button", name="向 林澈 表达想认识").click()
            zhou_page.get_by_text("已向 林澈 表达“想认识”", exact=True).wait_for(
                timeout=5000
            )
            lin_page.locator('.app-nav [data-tab="connections"]').click()
            lin_page.get_by_text("想认识你", exact=True).wait_for(timeout=8000)
            lin_page.get_by_role("button", name="接受", exact=True).click()
            lin_page.get_by_text("已接受连接", exact=True).wait_for(timeout=5000)

            zhou_page.locator('.app-nav [data-tab="connections"]').click()
            zhou_page.get_by_text("已建联", exact=True).first.wait_for(timeout=8000)
            zhou_page.get_by_role("button", name="继续项目协作").click()
            zhou_page.get_by_role("button", name="共同填写方向草案").click()
            zhou_page.locator('input[name="audience"]').fill("线下黑客松参与者")
            zhou_page.locator('input[name="problem"]').fill("现场协作难以继续")
            zhou_page.locator('input[name="outcome"]').fill("让真实交流进入启动流程")
            zhou_page.get_by_role("button", name="确认我的方向草案").click()
            zhou_page.get_by_role("button", name="模拟林澈确认方向").click()
            zhou_page.get_by_role("button", name="创建项目并邀请入队").click()
            zhou_page.get_by_role("heading", name="已邀请 林澈 加入项目").wait_for(
                timeout=8000
            )
            zhou_page.locator('[data-action="view-connection"]').click()

            lin_page.locator('.app-nav [data-tab="collaboration"]').click()
            lin_page.get_by_text("入队邀请", exact=True).wait_for(timeout=8000)
            lin_page.get_by_role("button", name="确认入队").click()
            lin_page.get_by_text("已确认入队", exact=False).wait_for(timeout=5000)
            lin_page.get_by_text("离线会议洞察终端", exact=True).wait_for(timeout=8000)

            zhou_page.locator('.app-nav [data-tab="collaboration"]').click()
            zhou_page.get_by_role("button", name="生成启动计划").wait_for(timeout=8000)
            zhou_page.get_by_role("button", name="生成启动计划").click()
            zhou_page.get_by_text("人机协作启动计划", exact=True).wait_for(timeout=8000)
            lin_page.get_by_text("人机协作启动计划", exact=True).wait_for(timeout=8000)
            lin_page.get_by_role("button", name="我来负责").first.click()
            lin_page.get_by_text("任务已认领", exact=True).wait_for(timeout=5000)

            _, projects = request_json(
                f"{backend_url}/api/projects?event_id=hackathon-2026",
                user_id="user-lin",
            )
            project_id = projects["projects"][0]["id"]
            _, room = request_json(
                f"{backend_url}/api/projects/{project_id}/room",
                user_id="user-lin",
            )
            assert any(
                task["confirmed_owner_id"] == "user-lin" for task in room["tasks"]
            )

            zhou_page.reload()
            zhou_page.locator('.app-nav [data-tab="collaboration"]').wait_for(timeout=8000)
            zhou_page.locator('.app-nav [data-tab="collaboration"]').click()
            zhou_page.get_by_text("离线会议洞察终端", exact=True).wait_for(timeout=8000)
            assert zhou_page.locator(".live-login-card").count() == 0
            lin_page.reload()
            lin_page.locator('.app-nav [data-tab="collaboration"]').wait_for(timeout=8000)
            lin_page.locator('.app-nav [data-tab="collaboration"]').click()
            lin_page.get_by_text("离线会议洞察终端", exact=True).wait_for(timeout=8000)
            assert lin_page.locator(".live-login-card").count() == 0

            zhou_context.close()
            lin_context.close()
            browser.close()

        print(json.dumps({
            "live_geolocation_connected": True,
            "real_backend_nearby_count": 1,
            "presence_removed_after_leaving": True,
            "visibility_pause_persisted": True,
            "platform_link_saved_rendered_and_removed": True,
            "live_profile_edit_persisted_after_reload": True,
            "live_profile_xss_blocked": True,
            "bearer_api_base_query_ignored": True,
            "access_code_api_base_query_ignored": True,
            "live_inbox_xss_blocked": True,
            "expired_session_overlay_cleared": True,
            "discover_sync_error_visible": True,
            "two_device_main_flow_persisted": True,
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
