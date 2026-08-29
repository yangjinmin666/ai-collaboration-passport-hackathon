"""Run the real mobile geolocation flow against a real local COSPAN API process."""

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


def mobile_sheet_metrics(locator):
    return locator.evaluate(
        """root => {
            const visible = (element) => {
                const style = getComputedStyle(element);
                const box = element.getBoundingClientRect();
                return style.display !== "none"
                    && style.visibility !== "hidden"
                    && style.opacity !== "0"
                    && box.width > 0
                    && box.height > 0;
            };
            const text = [...root.querySelectorAll("*")].filter(
                (element) => visible(element)
                    && [...element.childNodes].some(
                        (node) => node.nodeType === Node.TEXT_NODE
                            && node.textContent.trim()
                    )
            );
            const controls = [...root.querySelectorAll(
                "button, a[href], input:not([type='checkbox']), textarea, select, summary, "
                    + ".profile-block-public-confirm"
            )]
                .filter(visible)
                .map((element) => {
                    const box = element.getBoundingClientRect();
                    return {
                        label: element.getAttribute("aria-label")
                            || element.textContent.trim(),
                        width: box.width,
                        height: box.height,
                    };
                });
            const sheet = root.closest(".bottom-sheet") || root;
            const box = sheet.getBoundingClientRect();
            return {
                minimumFontSize: Math.min(
                    ...text.map(
                        (element) => parseFloat(
                            getComputedStyle(element).fontSize
                        )
                    )
                ),
                undersizedControls: controls.filter(
                    (item) => item.width < 44 || item.height < 44
                ),
                sheetBottom: box.bottom,
                viewportHeight: innerHeight,
                horizontalOverflow:
                    document.documentElement.scrollWidth > innerWidth,
            };
        }"""
    )


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
        "NODE_ENV": "test",
        "AUTH_OTP_SECRET": "browser-otp-secret",
        "AUTH_OTP_TEST_CODE": "246810",
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

            page.get_by_role("button", name="添加内容").click()
            block_library = page.locator("[data-profile-block-library]")
            block_library.get_by_text("作品 / 项目证据", exact=True).wait_for()
            assert block_library.get_by_text("经历", exact=True).is_visible()
            assert block_library.get_by_text("社交平台", exact=True).is_visible()
            assert block_library.get_by_role("button", name="Demo / App").is_visible()
            assert block_library.get_by_role("button", name="获奖").is_visible()
            assert block_library.get_by_role("button", name="X").is_visible()
            block_mobile_metrics = mobile_sheet_metrics(block_library)
            assert block_mobile_metrics["minimumFontSize"] >= 10, block_mobile_metrics
            assert block_mobile_metrics["undersizedControls"] == [], block_mobile_metrics
            assert abs(
                block_mobile_metrics["sheetBottom"]
                - block_mobile_metrics["viewportHeight"]
            ) <= 1
            assert not block_mobile_metrics["horizontalOverflow"]
            assert page.locator(".phone-status, .phone-island").count() == 0
            block_library.get_by_role("button", name="Demo / App").click()

            block_form = page.locator("[data-profile-block-form]")
            block_form.get_by_label("证据标题").wait_for()

            page.evaluate(
                """() => {
                    window.__rallyBlockPopstateCount = 0;
                    window.addEventListener("popstate", () => {
                        window.__rallyBlockPopstateCount += 1;
                    });
                }"""
            )
            page.go_back()
            block_library.get_by_text("作品 / 项目证据", exact=True).wait_for()
            assert block_form.count() == 0
            assert page.evaluate("window.__rallyBlockPopstateCount") == 1
            assert page.evaluate(
                "new URL(location.href).searchParams.get('overlay')"
            ) == "profile-block-library"
            assert page.evaluate(
                "new URL(location.href).searchParams.has('block')"
            ) is False

            page.go_back()
            block_library.wait_for(state="detached")
            page.get_by_role("button", name="添加内容").wait_for()
            assert page.locator("[data-profile-block-form]").count() == 0
            assert page.evaluate("window.__rallyBlockPopstateCount") == 2
            assert page.evaluate(
                "new URL(location.href).searchParams.has('overlay')"
            ) is False
            assert page.evaluate(
                "new URL(location.href).searchParams.get('view')"
            ) == "profile"

            page.get_by_role("button", name="添加内容").click()
            block_library.get_by_role("button", name="Demo / App").click()
            block_form.get_by_label("证据标题").wait_for()
            block_form.get_by_label("证据标题").fill("COSPAN Live 真机闭环")
            block_form.get_by_label("你完成了什么").fill("双设备建联、组队与刷新恢复")
            block_form.get_by_label("公开链接").fill(
                "https://rally.example/demo"
            )
            block_form.locator("[data-preview-link]").wait_for(state="visible")
            block_form_mobile_metrics = mobile_sheet_metrics(block_form)
            assert block_form_mobile_metrics["minimumFontSize"] >= 10, (
                block_form_mobile_metrics
            )
            assert block_form_mobile_metrics["undersizedControls"] == [], (
                block_form_mobile_metrics
            )
            assert abs(
                block_form_mobile_metrics["sheetBottom"]
                - block_form_mobile_metrics["viewportHeight"]
            ) <= 1
            assert not block_form_mobile_metrics["horizontalOverflow"]
            public_confirmation = block_form.get_by_text(
                '我确认开启“能力证据”字段，并公开上述范围', exact=True
            )
            assert public_confirmation.is_visible()
            assert "现有" in block_form.locator(
                ".profile-block-authorization"
            ).inner_text()
            public_confirmation.click()
            assert block_form.locator("[data-profile-block-preview]").get_by_text(
                "COSPAN Live 真机闭环", exact=True
            ).is_visible()
            block_form.get_by_role(
                "button", name="保存到对外协作卡"
            ).click()
            page.get_by_text("Demo / App 已添加并公开", exact=True).wait_for(
                timeout=5000
            )
            public_card = page.locator("[data-public-profile-card]")
            assert public_card.get_by_text(
                "COSPAN Live 真机闭环", exact=True
            ).is_visible()
            assert public_card.locator(
                'a[href="https://rally.example/demo"]'
            ).is_visible()
            _, me = request_json(f"{backend_url}/api/me", user_id="user-zhou")
            event_profile = next(
                profile for profile in me["profiles"]
                if profile["event_id"] == "hackathon-2026"
            )
            assert any(
                item.startswith("【项目证据·Demo】COSPAN Live 真机闭环")
                for item in event_profile["evidence"]
            )
            assert "evidence" in event_profile["visibility"]["public_fields"]
            _, discover_after_block = request_json(
                f"{backend_url}/api/events/hackathon-2026/discover",
                user_id="user-lin",
            )
            zhou_public = next(
                person for person in discover_after_block["people"]
                if person["user_id"] == "user-zhou"
            )
            assert any(
                item.startswith("【项目证据·Demo】COSPAN Live 真机闭环")
                for item in zhou_public["evidence"]
            )

            page.reload()
            page.locator('.app-nav [data-tab="profile"]').wait_for(timeout=8000)
            page.locator('.app-nav [data-tab="profile"]').click()
            assert page.locator("[data-public-profile-card]").get_by_text(
                "COSPAN Live 真机闭环", exact=True
            ).is_visible()

            page.get_by_role("button", name="添加内容").click()
            page.locator("[data-profile-block-library]").get_by_role(
                "button", name="获奖"
            ).click()
            award_form = page.locator("[data-profile-block-form]")
            award_form.get_by_label("奖项或认可").fill("Hackathon 最佳协作体验")
            award_form.get_by_label("获奖作品与贡献").fill(
                "负责 Live 组队闭环与真机验收"
            )
            award_form.get_by_role(
                "button", name="保存到对外协作卡"
            ).click()
            page.get_by_text("获奖 已添加并公开", exact=True).wait_for(
                timeout=5000
            )
            assert page.locator("[data-public-profile-card]").get_by_text(
                "Hackathon 最佳协作体验", exact=True
            ).is_visible()

            page.get_by_role("button", name="添加内容").click()
            page.locator("[data-profile-block-library]").get_by_role(
                "button", name="X"
            ).click()
            social_form = page.locator("[data-profile-block-form]")
            social_form.get_by_label("X 公开主页").fill("https://x.com/rally_live")
            social_form.get_by_role(
                "button", name="保存到对外协作卡"
            ).click()
            page.get_by_text("X 已添加并公开", exact=True).wait_for(timeout=5000)
            assert page.locator("[data-public-profile-card]").locator(
                'a[href="https://x.com/rally_live"]'
            ).is_visible()
            _, me = request_json(f"{backend_url}/api/me", user_id="user-zhou")
            assert any(
                item.startswith("【社交平台·X】X")
                and "https://x.com/rally_live" in item
                for item in next(
                    profile for profile in me["profiles"]
                    if profile["event_id"] == "hackathon-2026"
                )["evidence"]
            )
            assert "evidence" in next(
                profile for profile in me["profiles"]
                if profile["event_id"] == "hackathon-2026"
            )["visibility"]["public_fields"]

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
            assert next(
                link for link in me["platform_links"]
                if link["platform"] == "website"
            )["url"] == (
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
            profile_form.locator('textarea[name="evidence"]').fill("COSPAN Live API\n双设备协作 E2E")
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
            assert event_profile["evidence"][3:] == ["COSPAN Live API", "双设备协作 E2E"]
            assert event_profile["evidence"][0].startswith(
                "【项目证据·Demo】COSPAN Live 真机闭环"
            )
            assert event_profile["evidence"][1].startswith(
                "【经历·获奖】Hackathon 最佳协作体验"
            )
            assert event_profile["evidence"][2].startswith("【社交平台·X】X")
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
            token_page.get_by_text("COSPAN", exact=True).first.wait_for(timeout=4000)
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
                if "/api/auth/otp/challenges" in request.url
                else None,
            )
            untrusted_page.goto(
                f"{frontend_url}/?variant=A&live=1"
                "&apiBase=https://attacker.invalid/collect",
            )
            untrusted_page.get_by_label("手机号").fill("13800000001")
            untrusted_page.get_by_role("button", name="获取短信验证码").click()
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
            expiry_page.get_by_text("手机号登录", exact=True).wait_for(
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

            oauth_cancel_context = browser.new_context(
                viewport={"width": 390, "height": 844},
                is_mobile=True,
                has_touch=True,
            )
            oauth_cancel_page = oauth_cancel_context.new_page()
            oauth_cancel_page.goto(
                f"{frontend_url}/?variant=A&live=1"
                f"&apiBase={urllib.parse.quote(backend_url, safe=':/')}"
                "&oauth_provider=google&oauth_error=cancelled",
            )
            oauth_cancel_page.get_by_text(
                "你已取消第三方登录", exact=True
            ).wait_for(timeout=5000)
            oauth_cancel_query = urllib.parse.parse_qs(
                urllib.parse.urlparse(oauth_cancel_page.url).query
            )
            assert "oauth_provider" not in oauth_cancel_query
            assert "oauth_error" not in oauth_cancel_query
            assert "oauth_ticket" not in oauth_cancel_query
            oauth_cancel_context.close()

            android_auth_context = browser.new_context(
                viewport={"width": 390, "height": 844},
                is_mobile=True,
                has_touch=True,
            )
            android_auth_page = android_auth_context.new_page()
            android_auth_page.route(
                "**/api/auth/oauth/providers",
                lambda route: route.fulfill(
                    status=200,
                    content_type="application/json",
                    body=json.dumps({
                        "providers": {
                            "google": {
                                "enabled": True,
                                "android_enabled": True,
                            },
                            "wechat": {
                                "enabled": True,
                                "android_enabled": False,
                            },
                        }
                    }),
                ),
            )
            google_start_urls = []

            def capture_google_start(route):
                google_start_urls.append(route.request.url)
                route.fulfill(status=204, body="")

            android_auth_page.route(
                "**/api/auth/oauth/google/start**",
                capture_google_start,
            )
            android_auth_page.goto(
                f"{frontend_url}/?variant=A&live=1&source=android-app"
                f"&apiBase={urllib.parse.quote(backend_url, safe=':/')}",
            )
            wechat_button = android_auth_page.get_by_role(
                "button", name="微信登录"
            )
            google_button = android_auth_page.get_by_role(
                "button", name="Google 登录"
            )
            assert wechat_button.count() == 0
            assert google_button.is_enabled()
            google_button.click()
            android_auth_page.wait_for_timeout(300)
            assert len(google_start_urls) == 1
            google_start_query = urllib.parse.parse_qs(
                urllib.parse.urlparse(google_start_urls[0]).query
            )
            assert google_start_query["return_to"] == [
                f"{backend_url}/auth/android"
            ]
            assert len(google_start_query["code_challenge"][0]) == 43
            android_auth_context.close()

            first_time_context = browser.new_context(
                viewport={"width": 390, "height": 844},
                is_mobile=True,
                has_touch=True,
            )
            first_time_page = first_time_context.new_page()
            first_time_page.goto(
                f"{frontend_url}/?variant=A&live=1"
                f"&apiBase={urllib.parse.quote(backend_url, safe=':/')}",
            )
            first_time_page.get_by_role(
                "heading", name="手机号登录"
            ).wait_for(timeout=5000)
            assert first_time_page.get_by_label("怎么称呼你").count() == 0
            assert first_time_page.get_by_text(
                "合拍 · 人与人先相遇，人与 Agent 再共创。", exact=True
            ).is_visible()
            assert first_time_page.locator(".live-oauth-button:disabled").count() == 0
            login_metrics = mobile_sheet_metrics(
                first_time_page.locator(".live-login-card")
            )
            assert login_metrics["minimumFontSize"] >= 10, login_metrics
            assert login_metrics["undersizedControls"] == [], login_metrics
            assert not login_metrics["horizontalOverflow"], login_metrics
            first_time_page.get_by_label("手机号").fill("13300133000")
            first_time_page.get_by_role(
                "button", name="获取短信验证码"
            ).click()
            first_time_page.get_by_label("6 位验证码").fill("000000")
            first_time_page.get_by_role(
                "button", name="验证并进入 COSPAN"
            ).click()
            first_time_page.get_by_text(
                "验证码错误、已过期或尝试次数已用完", exact=True
            ).wait_for(timeout=5000)
            first_time_page.get_by_label("6 位验证码").fill("246810")
            first_time_page.get_by_role(
                "button", name="验证并进入 COSPAN"
            ).click()
            first_time_page.get_by_role(
                "heading", name="不用从头自我介绍。"
            ).wait_for(timeout=8000)
            assert first_time_page.locator("[data-live-profile-form]").count() == 0
            onboarding_metrics = mobile_sheet_metrics(
                first_time_page.locator("[data-onboarding-form]")
            )
            assert onboarding_metrics["minimumFontSize"] >= 10, onboarding_metrics
            assert onboarding_metrics["undersizedControls"] == [], onboarding_metrics
            assert not onboarding_metrics["horizontalOverflow"], onboarding_metrics
            first_time_page.get_by_label("GitHub").fill(
                "https://github.com/cospan-demo"
            )
            first_time_page.get_by_role("button", name="下一步").click()
            first_time_page.get_by_label("作品或项目名称").fill(
                "现场协作终端"
            )
            first_time_page.get_by_label("公开链接 选填").fill(
                "https://example.com/cospan-demo"
            )
            first_time_page.get_by_label("我做了什么").fill(
                "负责产品流程与真机演示"
            )
            first_time_page.get_by_label("今天可以投入多久").fill(
                "今天可投入 6 小时"
            )
            first_time_page.get_by_role("button", name="有 Idea 找人").click()
            first_time_page.get_by_role("button", name="下一步").click()
            first_time_page.get_by_label("你怎么介绍自己的角色").fill(
                "AI 产品与原型构建者"
            )
            first_time_page.get_by_label("你会什么 3–5 项，用逗号分隔").fill(
                "产品，交互，AI coding"
            )
            first_time_page.get_by_label("你在关注什么").fill(
                "Agent，现场协作"
            )
            first_time_page.get_by_label("我的 builder's vibe 是").fill(
                "把模糊想法快速做成能被真实体验的产品。"
            )
            first_time_page.get_by_role("button", name="下一步").click()
            first_time_page.get_by_role("button", name="选择头像 2").click()
            first_time_page.get_by_label("怎么称呼你").fill("小雨")
            first_time_page.get_by_label(
                "我确认将以上资料公开到本场展会；可以随时修改、暂停或撤回"
            ).check()
            first_time_page.get_by_role(
                "button", name="完成介绍 · 开始发现"
            ).click()
            first_time_page.locator(".app-nav").wait_for(timeout=8000)
            first_time_page.reload()
            first_time_page.locator(".app-nav").wait_for(timeout=8000)
            first_time_page.get_by_role("button", name="我的").click()
            assert first_time_page.get_by_text("小雨", exact=True).first.is_visible()
            assert first_time_page.get_by_text(
                "AI 产品与原型构建者", exact=True
            ).first.is_visible()
            saved_identity = first_time_page.evaluate(
                """async () => {
                    const response = await fetch(
                        `${localStorage.getItem("rally_api_base")}/api/me`,
                        {headers: {
                            authorization: `Bearer ${localStorage.getItem("rally_access_token")}`,
                        }},
                    );
                    return response.json();
                }"""
            )
            saved_profile = next(
                profile for profile in saved_identity["profiles"]
                if profile["event_id"] == "hackathon-2026"
            )
            assert saved_profile["role"] == "AI 产品与原型构建者"
            assert saved_profile["skills"] == ["产品", "交互", "AI coding"]
            assert saved_profile["interests"] == ["Agent", "现场协作"]
            assert saved_profile["availability"] == "今天可投入 6 小时"
            assert saved_profile["collaboration_need"] == (
                "把模糊想法快速做成能被真实体验的产品。"
            )
            assert saved_profile["visibility"]["state"] == "VISIBLE"
            assert any(
                "现场协作终端" in item for item in saved_profile["evidence"]
            )
            assert any(
                link["platform"] == "github"
                and link["url"] == "https://github.com/cospan-demo"
                for link in saved_identity["platform_links"]
            )
            first_time_context.close()

            def login_live(live_page, user_id):
                identities = {
                    "user-zhou": "13800000001",
                    "user-lin": "13800000002",
                }
                phone = identities[user_id]
                live_page.goto(
                    f"{frontend_url}/?variant=A&live=1"
                    f"&apiBase={urllib.parse.quote(backend_url, safe=':/')}",
                )
                live_page.get_by_label("手机号").fill(phone)
                live_page.get_by_role("button", name="获取短信验证码").click()
                live_page.get_by_label("6 位验证码").fill("246810")
                live_page.get_by_role(
                    "button", name="验证并进入 COSPAN"
                ).click()
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
            zhou_page.get_by_text("已表达想认识，线下碰卡后才会交换联系方式", exact=True).wait_for(
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

            zhou_page.set_viewport_size({"width": 1440, "height": 900})
            zhou_page.goto(
                f"{frontend_url}/?variant=A&workspace=1&view=collaboration&live=1"
                f"&apiBase={urllib.parse.quote(backend_url, safe=':/')}",
            )
            desktop_workspace = zhou_page.locator(
                f'.live-workspace-view[data-live-project-id="{project_id}"]'
            )
            desktop_workspace.wait_for(timeout=8000)
            desktop_grid = desktop_workspace.locator(".workspace-desktop-grid")
            assert desktop_grid.is_visible()
            assert desktop_grid.get_by_text("周闻", exact=True).first.is_visible()
            assert desktop_grid.get_by_text("林澈", exact=True).first.is_visible()
            assert desktop_grid.locator("[data-live-task-id]").count() == len(
                room["tasks"]
            )
            assert desktop_grid.get_by_text("0 / 2 位成员已确认", exact=True).is_visible()

            unowned_task = next(
                task for task in room["tasks"]
                if task["confirmed_owner_id"] is None
            )
            desktop_grid.locator(
                f'[data-live-task-id="{unowned_task["id"]}"] '
                '[data-action="live-task-action"][data-resolution="claim"]'
            ).click()
            zhou_page.get_by_text("任务已认领", exact=True).wait_for(timeout=5000)
            task_card = desktop_grid.locator(
                f'[data-live-task-id="{unowned_task["id"]}"]'
            )
            task_card.get_by_text("负责人：周闻", exact=False).wait_for(timeout=8000)
            assert task_card.get_by_text("我负责", exact=True).is_visible()
            assert task_card.get_by_role("button", name="开始任务").count() == 0

            desktop_grid.get_by_role("button", name="确认当前计划").click()
            zhou_page.get_by_text("已记录你的确认，等待其他成员", exact=True).wait_for(
                timeout=5000
            )
            desktop_grid.get_by_text("1 / 2 位成员已确认", exact=True).wait_for(
                timeout=8000
            )
            _, desktop_room = request_json(
                f"{backend_url}/api/projects/{project_id}/room",
                user_id="user-zhou",
            )
            assert desktop_room["confirmation_progress"] == {
                "confirmed": 1,
                "required": 2,
            }
            assert any(
                task["id"] == unowned_task["id"]
                and task["confirmed_owner_id"] == "user-zhou"
                for task in desktop_room["tasks"]
            )
            assert any(
                item["event_type"] == "task_claimed"
                and item["source"] == "desktop"
                for item in desktop_room["activity"]
            )
            assert any(
                item["event_type"] == "plan_confirmation_recorded"
                and item["source"] == "desktop"
                for item in desktop_room["activity"]
            )

            lin_page.locator(".workspace-mobile-content").get_by_role(
                "button", name="确认当前计划"
            ).click()
            lin_page.locator(
                '.toast:has-text("全员已确认当前计划")'
            ).wait_for(timeout=5000)
            desktop_grid.get_by_text("2 / 2 位成员已确认", exact=True).wait_for(
                timeout=8000
            )
            task_card.get_by_role("button", name="开始任务").wait_for(timeout=8000)

            zhou_page.reload()
            desktop_workspace.wait_for(timeout=8000)
            refreshed_desktop_grid = desktop_workspace.locator(
                ".workspace-desktop-grid"
            )
            assert refreshed_desktop_grid.is_visible()
            assert refreshed_desktop_grid.get_by_text(
                "2 / 2 位成员已确认", exact=True
            ).is_visible()
            refreshed_task_card = refreshed_desktop_grid.locator(
                f'[data-live-task-id="{unowned_task["id"]}"]'
            )
            assert "负责人：周闻" in refreshed_task_card.locator("em").inner_text()
            assert refreshed_task_card.get_by_role(
                "button", name="开始任务"
            ).is_visible()

            zhou_context.close()
            lin_context.close()
            browser.close()

        print(json.dumps({
            "live_geolocation_connected": True,
            "real_backend_nearby_count": 1,
            "presence_removed_after_leaving": True,
            "visibility_pause_persisted": True,
            "platform_link_saved_rendered_and_removed": True,
            "profile_block_builder_saved_and_persisted": True,
            "profile_block_mobile_contract": True,
            "fake_phone_status_removed": True,
            "live_profile_edit_persisted_after_reload": True,
            "live_profile_xss_blocked": True,
            "bearer_api_base_query_ignored": True,
            "sms_login_api_base_query_ignored": True,
            "live_inbox_xss_blocked": True,
            "expired_session_overlay_cleared": True,
            "discover_sync_error_visible": True,
            "first_time_phone_user_profile_ready": True,
            "two_device_main_flow_persisted": True,
            "live_desktop_workspace_connected": True,
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
