"""PROTOTYPE smoke test for the mobile demo."""

import json
from io import BytesIO
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:4173"
OUTPUT_DIR = Path(__file__).with_name("artifacts")


def bottom_center_brightness(png: bytes) -> float:
    """Measure whether the avatar crop exposes a full-width gray gutter."""
    image = Image.open(BytesIO(png)).convert("RGB")
    center_x = image.width // 2
    y = image.height - 6
    half_sample_width = max(2, round(image.width * 0.2))
    brightnesses = sorted(
        sum(image.getpixel((x, y))) / 3
        for x in range(center_x - half_sample_width, center_x + half_sample_width + 1)
    )
    return brightnesses[round((len(brightnesses) - 1) * 0.8)]


def subject_offset_from_center(png: bytes) -> tuple[float, float]:
    """Return the visual subject's bounding-box offset from its circular frame."""
    image = Image.open(BytesIO(png)).convert("RGB")
    center_x = (image.width - 1) / 2
    center_y = (image.height - 1) / 2
    radius = min(image.size) / 2 - 4
    subject_pixels = []
    for y in range(image.height):
        for x in range(image.width):
            if (x - center_x) ** 2 + (y - center_y) ** 2 > radius ** 2:
                continue
            red, green, blue = image.getpixel((x, y))
            if max(red, green, blue) - min(red, green, blue) > 10 or max(red, green, blue) < 190:
                subject_pixels.append((x, y))
    x_values = [x for x, _ in subject_pixels]
    y_values = [y for _, y in subject_pixels]
    subject_center_x = (min(x_values) + max(x_values)) / 2
    subject_center_y = (min(y_values) + max(y_values)) / 2
    return subject_center_x - center_x, subject_center_y - center_y


def subject_pixel_ratio(png: bytes) -> float:
    """Measure that a rendered avatar contains a face instead of a blank white crop."""
    image = Image.open(BytesIO(png)).convert("RGB")
    center_x = (image.width - 1) / 2
    center_y = (image.height - 1) / 2
    radius = min(image.size) / 2 - 3
    inside = 0
    subject = 0
    for y in range(image.height):
        for x in range(image.width):
            if (x - center_x) ** 2 + (y - center_y) ** 2 > radius ** 2:
                continue
            inside += 1
            red, green, blue = image.getpixel((x, y))
            if max(red, green, blue) - min(red, green, blue) > 12 or max(red, green, blue) < 205:
                subject += 1
    return subject / inside


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
            if variant == "A":
                report["variants"][variant]["role_roster_count"] = page.locator(".role-roster-person").count()
                report["variants"][variant]["ranked_people_count"] = page.locator(".person-row").count()
                assert report["variants"][variant]["role_roster_count"] == 11
                assert report["variants"][variant]["ranked_people_count"] == 11
            if variant == "B":
                report["variants"][variant]["radar_people_count"] = page.locator(".radar-person").count()
                assert report["variants"][variant]["radar_people_count"] == 11
                avatar_subject_ratios = [
                    subject_pixel_ratio(page.locator(".radar-person .memoji-avatar").nth(index).screenshot())
                    for index in range(page.locator(".radar-person .memoji-avatar").count())
                ]
                report["variants"][variant]["radar_avatars_have_subjects"] = all(
                    ratio >= 0.06 for ratio in avatar_subject_ratios
                )
                assert report["variants"][variant]["radar_avatars_have_subjects"], avatar_subject_ratios
            if variant == "C":
                report["variants"][variant]["ledger_people_count"] = page.locator(".ledger-person").count()
                assert report["variants"][variant]["ledger_people_count"] == 11
            if variant == "B":
                center_avatar_geometry = page.locator(".radar-self").evaluate(
                    """button => {
                        const avatar = button.firstElementChild;
                        const buttonBox = button.getBoundingClientRect();
                        const avatarBox = avatar.getBoundingClientRect();
                        const style = getComputedStyle(button);
                        const innerWidth = buttonBox.width
                            - parseFloat(style.borderLeftWidth)
                            - parseFloat(style.borderRightWidth);
                        const innerHeight = buttonBox.height
                            - parseFloat(style.borderTopWidth)
                            - parseFloat(style.borderBottomWidth);
                        return {
                            avatarWidth: avatarBox.width,
                            avatarHeight: avatarBox.height,
                            innerWidth,
                            innerHeight,
                            overflow: style.overflow,
                        };
                    }"""
                )
                report["variants"][variant]["center_avatar_is_circle"] = (
                    abs(center_avatar_geometry["avatarWidth"] - center_avatar_geometry["avatarHeight"]) < 0.5
                    and abs(center_avatar_geometry["avatarWidth"] - center_avatar_geometry["innerWidth"]) < 0.5
                    and abs(center_avatar_geometry["avatarHeight"] - center_avatar_geometry["innerHeight"]) < 0.5
                    and center_avatar_geometry["overflow"] == "hidden"
                )
                assert report["variants"][variant]["center_avatar_is_circle"], center_avatar_geometry

                radar_avatar_brightness = bottom_center_brightness(
                    page.locator(".radar-person .memoji-avatar").first.screenshot()
                )
                page.locator(".app-nav [data-tab='profile']").click()
                profile_avatar_brightness = bottom_center_brightness(
                    page.locator(".profile-intro .memoji-avatar").screenshot()
                )
                report["variants"][variant]["avatar_circle_has_no_gray_gutter"] = (
                    min(radar_avatar_brightness, profile_avatar_brightness) >= 248
                )
                assert report["variants"][variant]["avatar_circle_has_no_gray_gutter"], {
                    "radar": radar_avatar_brightness,
                    "profile": profile_avatar_brightness,
                }

                page.evaluate(
                    """() => {
                        const gallery = document.createElement('div');
                        gallery.id = 'avatar-centering-test';
                        gallery.style.cssText = 'position:fixed;inset:0;z-index:9999;display:grid;grid-template-columns:repeat(4,86px);gap:8px;padding:8px;background:#fff';
                        gallery.innerHTML = Array.from({length: 12}, (_, index) =>
                            `<span class="memoji-avatar memoji-${index + 1} glyph-xl" data-avatar-test="${index + 1}"></span>`
                        ).join('');
                        document.body.appendChild(gallery);
                    }"""
                )
                avatar_offsets = {
                    str(index): subject_offset_from_center(
                        page.locator(f'[data-avatar-test="{index}"]').screenshot()
                    )
                    for index in range(1, 13)
                }
                page.locator("#avatar-centering-test").evaluate("gallery => gallery.remove()")
                report["variants"][variant]["avatar_subjects_are_centered"] = all(
                    abs(horizontal) <= 1.5 and abs(vertical) <= 1.5
                    for horizontal, vertical in avatar_offsets.values()
                )
                assert report["variants"][variant]["avatar_subjects_are_centered"], avatar_offsets

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
