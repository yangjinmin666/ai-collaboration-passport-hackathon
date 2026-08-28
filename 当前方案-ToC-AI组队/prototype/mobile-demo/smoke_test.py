"""PROTOTYPE smoke test for the mobile demo."""

import json
from pathlib import Path

from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:4173"
OUTPUT_DIR = Path(__file__).with_name("artifacts")


def main():
    OUTPUT_DIR.mkdir(exist_ok=True)
    report = {"variants": {}, "flow": {}, "errors": []}

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=1,
            is_mobile=True,
            has_touch=True,
        )
        page = context.new_page()
        page.on("console", lambda msg: report["errors"].append(f"console:{msg.type}:{msg.text}") if msg.type == "error" else None)
        page.on("pageerror", lambda error: report["errors"].append(f"page:{error}"))

        for variant in ("A", "B", "C"):
            page.goto(f"{BASE_URL}/?variant={variant}")
            page.wait_for_load_state("networkidle")
            page.screenshot(path=str(OUTPUT_DIR / f"variant-{variant}.png"), full_page=True)
            report["variants"][variant] = {
                "title": page.title(),
                "variant": page.locator("body").get_attribute("data-variant"),
                "nav_buttons": page.locator(".app-nav button").count(),
                "switcher_visible": page.locator(".prototype-switcher").is_visible(),
                "body_scroll_width": page.evaluate("document.body.scrollWidth"),
                "viewport_width": page.evaluate("window.innerWidth"),
            }

        page.goto(f"{BASE_URL}/?variant=C&onboarding=1")
        page.wait_for_load_state("networkidle")
        report["flow"]["onboarding_starts_at_status"] = page.get_by_text("你现在来现场，最需要什么？", exact=True).is_visible()
        report["flow"]["switcher_hidden_during_onboarding"] = page.locator(".prototype-switcher").count() == 0
        page.get_by_role("button", name="正在找队伍").click()
        page.get_by_role("button", name="下一步 · 组装能力证据").click()
        page.get_by_role("button", name="即刻 构建动态 添加").click()
        page.get_by_role("button", name="交给 AI 生成草稿").click()
        page.get_by_role("button", name="AI 重组").click()
        page.get_by_role("button", name="确认草稿 · 预览公开面").click()
        page.get_by_role("button", name="工牌公开面").click()
        report["flow"]["onboarding_surface_visible"] = page.locator(".onboarding-eink").is_visible()
        page.wait_for_timeout(350)
        page.screenshot(path=str(OUTPUT_DIR / "onboarding-eink-preview.png"), full_page=True)
        page.get_by_role("button", name="公开协作护照 · 进入现场").click()
        report["flow"]["onboarding_publishes_to_c"] = (
            page.locator("body").get_attribute("data-flow") == "product"
            and page.locator("body").get_attribute("data-variant") == "C"
        )

        page.goto(f"{BASE_URL}/?variant=A")
        page.wait_for_load_state("networkidle")
        page.locator("[data-variant-step='1']").click()
        report["flow"]["switcher_reaches_b"] = page.locator("body").get_attribute("data-variant") == "B"

        page.goto(f"{BASE_URL}/?variant=A")
        page.wait_for_load_state("networkidle")
        page.locator(".person-row[data-person='lin']").click()
        page.screenshot(path=str(OUTPUT_DIR / "step-1-match-reason.png"), full_page=True)
        page.get_by_role("button", name="想认识", exact=True).click()
        page.get_by_role("button", name="模拟碰卡直连").click()
        page.screenshot(path=str(OUTPUT_DIR / "step-2-card-handshake.png"), full_page=True)
        page.get_by_role("button", name="模拟双方主动碰卡").click()
        page.screenshot(path=str(OUTPUT_DIR / "step-3-connected.png"), full_page=True)
        page.get_by_role("button", name="邀请加入「离线会议洞察终端」").click()
        page.screenshot(path=str(OUTPUT_DIR / "step-4-team-joined.png"), full_page=True)
        page.get_by_role("button", name="查看 AI 启动包").click()
        page.locator("[data-task='hardware-choice']").click()
        page.screenshot(path=str(OUTPUT_DIR / "flow-complete.png"), full_page=True)

        report["flow"] = {
            **report["flow"],
            "project_title_visible": page.get_by_text("离线会议洞察终端", exact=True).is_visible(),
            "hardware_member_visible": page.locator(".team-avatar.new").is_visible(),
            "task_accepted": "accepted" in (page.locator("[data-task='hardware-choice']").get_attribute("class") or ""),
            "state_label": page.locator(".state-ledger strong").text_content() if page.locator(".state-ledger strong").count() else "hidden-on-mobile",
        }

        page.locator(".app-nav [data-tab='profile']").click()
        page.locator("[data-action='toggle-visible']").click()
        report["flow"]["visibility_paused"] = "is-hidden" in (page.locator(".eink-card").get_attribute("class") or "")
        page.screenshot(path=str(OUTPUT_DIR / "profile-eink.png"), full_page=True)

        desktop = browser.new_page(viewport={"width": 1440, "height": 900})
        desktop.on("console", lambda msg: report["errors"].append(f"desktop-console:{msg.type}:{msg.text}") if msg.type == "error" else None)
        desktop.on("pageerror", lambda error: report["errors"].append(f"desktop-page:{error}"))
        desktop.goto(f"{BASE_URL}/?variant=A")
        desktop.wait_for_load_state("networkidle")
        desktop.screenshot(path=str(OUTPUT_DIR / "desktop-presentation.png"), full_page=True)
        report["flow"]["desktop_fits_width"] = desktop.evaluate("document.body.scrollWidth <= window.innerWidth")
        desktop.close()

        browser.close()

    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
