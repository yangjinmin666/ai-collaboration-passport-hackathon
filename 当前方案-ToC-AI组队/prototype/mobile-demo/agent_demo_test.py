from urllib.parse import urlparse

from playwright.sync_api import Route, sync_playwright


BASE_URL = "http://127.0.0.1:4173"
PACKAGED_API = "https://api.example.invalid"


def fulfill_packaged_document(route: Route):
    response = route.fetch()
    body = response.text().replace(
        '<meta name="rally-api-origin" content="" />',
        f'<meta name="rally-api-origin" content="{PACKAGED_API}" />',
    )
    route.fulfill(response=response, body=body)


def fulfill_live_api(route: Route):
    path = urlparse(route.request.url).path
    if path == "/api/auth/oauth/providers":
        payload = {"providers": {"wechat": {}, "google": {}}}
    elif path == "/api/me":
        payload = {
            "user": {"id": "user-zhou", "display_name": "周闻", "avatar": "memoji-5"},
            "profiles": [{
                "event_id": "hackathon-2026",
                "role": "AI 应用工程师",
                "status": "未组队",
                "skills": ["Agent", "API", "快速原型"],
                "interests": ["AI 硬件"],
                "availability": "本场可投入 6 小时",
                "collaboration_preferences": ["快速原型"],
                "collaboration_need": "寻找可以一起做出 Demo 的队友",
                "evidence": [],
                "visibility": {"state": "VISIBLE"},
            }],
            "platform_links": [],
        }
    elif path.endswith("/discover"):
        payload = {"people": []}
    elif path == "/api/connections/requests":
        payload = {"requests": []}
    elif path == "/api/team-invitations":
        payload = {"invitations": []}
    elif path == "/api/projects":
        payload = {"projects": []}
    elif path == "/api/analytics/events":
        payload = {"accepted": 0}
    else:
        raise AssertionError(f"Unexpected Live API request: {route.request.method} {route.request.url}")
    route.fulfill(status=200, content_type="application/json", json=payload)


def assert_demo_flow(page):
    page.get_by_role("heading", name="你和 林澈 匹配成功").wait_for()
    page.get_by_text("匹配成功只建立关系", exact=False).wait_for()
    page.get_by_role("button", name="查看待确认的协作方向").click()
    page.get_by_role("heading", name="由人确认 这个协作方向").wait_for()
    page.get_by_role("button", name="确认这个协作方向").click()
    page.get_by_role("heading", name="方向已由双方确认").wait_for()
    page.get_by_role("button", name="创建项目并邀请入队").click()
    page.get_by_role("heading", name="已邀请 林澈 加入项目").wait_for()
    page.get_by_role("button", name="模拟对方确认加入").click()
    page.get_by_role("heading", name="林澈 已加入项目").wait_for()
    page.get_by_role("button", name="进入人机协作空间").click()

    page.get_by_role("button", name="查看分工建议").click()
    page.get_by_role("heading", name="Agent 已生成分工建议").wait_for()
    assignments = page.locator(".workspace-mobile-content .assignment-list > article")
    assert assignments.count() == 3
    assert assignments.get_by_text("建议负责人：", exact=False).count() == 3
    assert assignments.locator("[data-action='accept-demo-assignment']").count() == 3
    assert assignments.get_by_text("已接受", exact=True).count() == 0

    assignments.nth(1).get_by_role("button", name="接受建议").click()
    accepted_assignment = assignments.nth(1)
    accepted_assignment.get_by_text("已接受", exact=True).wait_for()
    accepted_assignment.get_by_text("当前负责人：周闻", exact=False).wait_for()

    page.get_by_role("button", name="模拟团队确认并开始协作").click()
    page.get_by_text("先由每项任务的负责人明确接受", exact=True).wait_for()
    assignments.nth(0).get_by_role("button", name="我来负责").click()
    assignments.nth(2).get_by_role("button", name="我来负责").click()
    page.get_by_role("button", name="模拟团队确认并开始协作").click()
    page.get_by_role("heading", name="团队已确认启动方案").wait_for()
    assert assignments.locator("[data-action='accept-demo-assignment']").count() == 0
    assert page.locator(".workspace-owned-tasks .task-item.accepted").count() == 3
    assert page.locator(".workspace-owned-tasks [data-task]").count() == 0


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    direct_page = browser.new_page(viewport={"width": 390, "height": 844})
    direct_page.set_default_timeout(3_000)
    demo_api_requests = []
    direct_page.route(f"{BASE_URL}/?*", fulfill_packaged_document)
    direct_page.route(
        f"{PACKAGED_API}/**",
        lambda route: (
            demo_api_requests.append((route.request.method, route.request.url)),
            route.fulfill(status=204),
        )[-1],
    )
    direct_page.goto(
        f"{BASE_URL}/?live=0&demoFlow=agent&variant=A&splash=0",
        wait_until="networkidle",
    )
    assert_demo_flow(direct_page)
    assert demo_api_requests == [], f"Demo made API requests: {demo_api_requests}"

    entry_page = browser.new_page(viewport={"width": 390, "height": 844})
    entry_page.set_default_timeout(3_000)
    live_api_requests = []
    entry_page.route(f"{BASE_URL}/?*", fulfill_packaged_document)
    entry_page.route(
        f"{PACKAGED_API}/**",
        lambda route: (
            live_api_requests.append((route.request.method, route.request.url)),
            fulfill_live_api(route),
        )[-1],
    )
    entry_page.goto(
        f"{BASE_URL}/?live=1&source=android-app&demoUser=user-zhou&view=collaboration&splash=0",
        wait_until="networkidle",
    )
    entry_page.get_by_role("button", name="演示完整 Agent 协作链").wait_for()
    live_api_requests.clear()
    entry_page.get_by_role("button", name="演示完整 Agent 协作链").click()
    assert_demo_flow(entry_page)
    assert not any(
        urlparse(url).path.startswith("/api/")
        for _, url in live_api_requests
    ), f"Android Demo transition wrote or flushed API data: {live_api_requests}"

    browser.close()

print("COSPAN mobile Agent demo flow passed")
