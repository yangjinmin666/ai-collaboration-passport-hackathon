"""PROTOTYPE smoke test for the mobile demo."""

import json
from io import BytesIO
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:4173"
OUTPUT_DIR = Path(__file__).with_name("artifacts")


def mobile_visual_baseline(page) -> dict:
    """Return violations of the frozen mobile type and touch-target rules."""
    return page.evaluate(
        """() => {
            const isVisible = (element) => {
                const style = getComputedStyle(element);
                const box = element.getBoundingClientRect();
                return style.display !== 'none'
                    && style.visibility !== 'hidden'
                    && Number(style.opacity) > 0
                    && box.width > 0
                    && box.height > 0;
            };
            const label = (element) => {
                const raw = element.getAttribute('aria-label') || element.textContent || element.tagName;
                return raw.replace(/\\s+/g, ' ').trim().slice(0, 48);
            };
            const typeExclusions = '.eink-card, .onboarding-eink';
            const textNodes = [...document.querySelectorAll('body *')].filter((element) =>
                isVisible(element)
                && !element.closest(typeExclusions)
                && [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim())
            );
            const fontViolations = textNodes.map((element) => ({
                element,
                size: parseFloat(getComputedStyle(element).fontSize),
            })).filter(({size}) => size < 10).map(({element, size}) => ({
                selector: element.className ? `.${String(element.className).trim().replace(/\\s+/g, '.')}` : element.tagName.toLowerCase(),
                label: label(element),
                size,
            }));

            const controlExclusions = '.radar-person, .radar-self, .overlay-backdrop';
            const controls = [...document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]')]
                .filter((element) => isVisible(element) && !element.closest(controlExclusions));
            const touchViolations = controls.map((element) => {
                const box = element.getBoundingClientRect();
                return {element, width: box.width, height: box.height};
            }).filter(({width, height}) => width < 44 || height < 44).map(({element, width, height}) => ({
                selector: element.className ? `.${String(element.className).trim().replace(/\\s+/g, '.')}` : element.tagName.toLowerCase(),
                label: label(element),
                width: Math.round(width * 10) / 10,
                height: Math.round(height * 10) / 10,
            }));

            return {
                minimumFontSize: Math.min(...textNodes.map((element) => parseFloat(getComputedStyle(element).fontSize))),
                fontViolations,
                touchViolations,
            };
        }"""
    )


def assert_mobile_visual_baseline(page, report: dict, label: str):
    baseline = mobile_visual_baseline(page)
    report[label] = {
        "minimum_font_size": baseline["minimumFontSize"],
        "font_violations": len(baseline["fontViolations"]),
        "touch_violations": len(baseline["touchViolations"]),
    }
    assert not baseline["fontViolations"], baseline["fontViolations"]
    assert not baseline["touchViolations"], baseline["touchViolations"]


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
    report = {"variants": {}, "flow": {}, "visual_baseline": {}, "errors": []}

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
                "discovery_tabs": page.locator(".discovery-tabs button").count(),
                "prototype_switcher_removed": page.locator(".prototype-switcher").count() == 0,
                "body_scroll_width": page.evaluate("document.body.scrollWidth"),
                "viewport_width": page.evaluate("window.innerWidth"),
            }
            assert report["variants"][variant]["nav_buttons"] == 4
            assert report["variants"][variant]["discovery_tabs"] == 3
            assert report["variants"][variant]["prototype_switcher_removed"]
            assert report["variants"][variant]["body_scroll_width"] <= report["variants"][variant]["viewport_width"]
            assert_mobile_visual_baseline(page, report["visual_baseline"], f"variant_{variant}")
            if variant == "A":
                report["variants"][variant]["active_recommendation_cards"] = page.locator(".recommendation-card-active").count()
                report["variants"][variant]["recommendation_progress_count"] = page.locator(".recommendation-progress i").count()
                report["variants"][variant]["table_like_lists_removed"] = (
                    page.locator(".role-roster-person, .person-row").count() == 0
                )
                assert report["variants"][variant]["active_recommendation_cards"] == 1
                assert report["variants"][variant]["recommendation_progress_count"] == 11
                assert report["variants"][variant]["table_like_lists_removed"]
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
                report["variants"][variant]["avatar_circle_has_no_gray_gutter"] = all(
                    brightness >= 248
                    for brightness in (radar_avatar_brightness, profile_avatar_brightness)
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

        page.goto(f"{BASE_URL}/?variant=A&build=hard-filters")
        page.wait_for_load_state("networkidle")
        page.get_by_role("button", name="设置筛选偏好").click()
        report["flow"]["discovery_filter_sheet_opens"] = page.get_by_text(
            "筛选偏好", exact=True
        ).is_visible()
        assert report["flow"]["discovery_filter_sheet_opens"]
        page.get_by_role("button", name="正在找队伍", exact=True).click()
        page.get_by_role("button", name="硬件／结构", exact=True).click()
        page.get_by_role("button", name="≥ 8h", exact=True).click()
        assert page.get_by_role("button", name="查看 2 人", exact=True).is_visible()
        assert_mobile_visual_baseline(page, report["visual_baseline"], "discovery_filters")
        page.screenshot(path=str(OUTPUT_DIR / "discovery-hard-filters.png"), full_page=True)
        page.get_by_role("button", name="查看 2 人", exact=True).click()
        report["flow"]["hard_filters_reduce_recommendations"] = (
            page.locator(".recommendation-progress i").count() == 2
            and page.locator(".discovery-filter-trigger > b").inner_text() == "3"
        )
        assert report["flow"]["hard_filters_reduce_recommendations"]
        page.locator("[data-discovery-view='B']").click()
        report["flow"]["hard_filters_apply_to_nearby"] = page.locator(".radar-person").count() == 2
        assert report["flow"]["hard_filters_apply_to_nearby"]
        page.locator("[data-discovery-view='C']").click()
        report["flow"]["hard_filters_apply_to_directory"] = page.locator(".ledger-person").count() == 2
        assert report["flow"]["hard_filters_apply_to_directory"]

        page.get_by_role("button", name="设置筛选偏好，已启用 3 项").click()
        page.get_by_role("button", name="重置", exact=True).click()
        page.get_by_role("button", name="查看 11 人", exact=True).click()
        report["flow"]["hard_filters_can_reset"] = (
            page.locator(".ledger-person").count() == 11
            and page.locator(".discovery-filter-trigger > b").count() == 0
        )
        assert report["flow"]["hard_filters_can_reset"]

        page.get_by_role("button", name="设置筛选偏好").click()
        page.get_by_role("button", name="安全／隐私", exact=True).click()
        page.get_by_role("button", name="≥ 8h", exact=True).click()
        page.get_by_role("button", name="查看 0 人", exact=True).click()
        report["flow"]["hard_filters_never_silently_relax"] = page.get_by_text(
            "RALLY 不会自动放宽你的筛选条件。调整状态、职能或投入时间后再查看。",
            exact=True,
        ).is_visible()
        assert report["flow"]["hard_filters_never_silently_relax"]

        page.goto(f"{BASE_URL}/?variant=A&workspace=1")
        page.wait_for_load_state("networkidle")
        page.locator(".app-nav [data-tab='discover']").click()
        page.locator("[data-action='dismiss-recommendation']").click()
        page.locator("[data-action='like-recommendation']").click()
        page.locator(".app-nav [data-tab='connections']").click()
        assert page.locator(".connection-card").count() == 1
        assert page.locator(".pending-row").count() == 1

        page.get_by_role("button", name="待回应", exact=True).click()
        report["flow"]["pending_connection_filter_works"] = (
            page.locator(".filter-row button.active").inner_text() == "待回应"
            and page.locator(".connection-card").count() == 0
            and page.locator(".pending-row").count() == 1
        )
        assert report["flow"]["pending_connection_filter_works"]

        page.get_by_role("button", name="已建联", exact=True).click()
        report["flow"]["connected_filter_works"] = (
            page.locator(".filter-row button.active").inner_text() == "已建联"
            and page.locator(".connection-card").count() == 1
            and page.locator(".pending-row").count() == 0
        )
        assert report["flow"]["connected_filter_works"]

        page.get_by_role("button", name="全部", exact=True).click()
        report["flow"]["all_connection_filter_works"] = (
            page.locator(".filter-row button.active").inner_text() == "全部"
            and page.locator(".connection-card").count() == 1
            and page.locator(".pending-row").count() == 1
        )
        assert report["flow"]["all_connection_filter_works"]

        page.goto(f"{BASE_URL}/?variant=C&onboarding=1")
        page.wait_for_load_state("networkidle")
        report["flow"]["onboarding_starts_at_status"] = page.get_by_text("你现在来现场，最需要什么？", exact=True).is_visible()
        report["flow"]["discovery_tabs_hidden_during_onboarding"] = page.locator(".discovery-tabs").count() == 0
        assert_mobile_visual_baseline(page, report["visual_baseline"], "onboarding_status")
        page.get_by_role("button", name="正在找队伍").click()
        page.get_by_role("button", name="下一步 · 组装能力证据").click()
        assert_mobile_visual_baseline(page, report["visual_baseline"], "onboarding_evidence")
        page.get_by_role("button", name="即刻 构建动态 添加").click()
        page.get_by_role("button", name="交给 AI 生成草稿").click()
        page.get_by_role("button", name="AI 重组").click()
        page.get_by_role("button", name="确认草稿 · 预览公开面").click()
        page.get_by_role("button", name="工牌公开面").click()
        report["flow"]["onboarding_surface_visible"] = page.locator(".onboarding-eink").is_visible()
        assert_mobile_visual_baseline(page, report["visual_baseline"], "onboarding_preview")
        page.wait_for_timeout(350)
        page.screenshot(path=str(OUTPUT_DIR / "onboarding-eink-preview.png"), full_page=True)
        page.get_by_role("button", name="公开协作护照 · 进入现场").click()
        report["flow"]["onboarding_publishes_to_c"] = (
            page.locator("body").get_attribute("data-flow") == "product"
            and page.locator("body").get_attribute("data-variant") == "C"
        )
        page.locator(".app-nav [data-tab='profile']").click()
        report["flow"]["published_passport_is_visible"] = "is-hidden" not in (
            page.locator(".eink-card").get_attribute("class") or ""
        )
        assert report["flow"]["published_passport_is_visible"]

        page.goto(f"{BASE_URL}/?variant=C&onboarding=1")
        page.wait_for_load_state("networkidle")
        page.get_by_role("button", name="稍后设置").click()
        page.locator(".app-nav [data-tab='profile']").click()
        report["flow"]["skipped_onboarding_stays_hidden"] = "is-hidden" in (
            page.locator(".eink-card").get_attribute("class") or ""
        )
        assert report["flow"]["skipped_onboarding_stays_hidden"]

        page.goto(f"{BASE_URL}/?variant=A")
        page.wait_for_load_state("networkidle")
        page.locator("[data-discovery-view='B']").click()
        report["flow"]["discovery_tabs_reach_nearby"] = page.locator("body").get_attribute("data-variant") == "B"
        assert report["flow"]["discovery_tabs_reach_nearby"]

        page.goto(f"{BASE_URL}/?variant=A")
        page.wait_for_load_state("networkidle")
        first_recommendation = page.locator(".recommendation-person h3").inner_text()
        page.locator(".recommendation-card-active").evaluate(
            """card => {
                const box = card.getBoundingClientRect();
                const startX = box.left + box.width / 2;
                const y = box.top + box.height / 2;
                card.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, pointerId:7, clientX:startX, clientY:y}));
                card.dispatchEvent(new PointerEvent('pointermove', {bubbles:true, pointerId:7, clientX:startX + 110, clientY:y}));
                card.dispatchEvent(new PointerEvent('pointerup', {bubbles:true, pointerId:7, clientX:startX + 110, clientY:y}));
            }"""
        )
        page.wait_for_timeout(260)
        report["flow"]["right_swipe_advances_recommendation"] = (
            page.locator(".recommendation-person h3").inner_text() != first_recommendation
            and page.locator(".recommendation-intro em").inner_text() == "2 / 11"
        )
        assert report["flow"]["right_swipe_advances_recommendation"]

        page.goto(f"{BASE_URL}/?variant=A")
        page.wait_for_load_state("networkidle")
        page.locator(".recommendation-card-active").click()
        report["flow"]["person_preview_shows_authored_bio_not_agent_summary"] = (
            page.get_by_text("本人简介", exact=True).is_visible()
            and page.get_by_text("原文", exact=True).is_visible()
            and page.locator(".person-sheet.is-preview").count() == 1
            and page.locator(".person-sheet.is-preview .ai-reason").count() == 0
        )
        assert report["flow"]["person_preview_shows_authored_bio_not_agent_summary"]
        assert_mobile_visual_baseline(page, report["visual_baseline"], "person_detail_sheet")
        page.screenshot(path=str(OUTPUT_DIR / "step-1-match-reason.png"), full_page=True)
        page.locator("[data-person-sheet-drag]").evaluate(
            """zone => {
                const box = zone.getBoundingClientRect();
                const x = box.left + box.width / 2;
                const startY = box.top + Math.min(box.height / 2, 28);
                zone.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, pointerId:9, clientX:x, clientY:startY}));
                zone.dispatchEvent(new PointerEvent('pointermove', {bubbles:true, pointerId:9, clientX:x, clientY:startY - 80}));
                zone.dispatchEvent(new PointerEvent('pointerup', {bubbles:true, pointerId:9, clientX:x, clientY:startY - 80}));
            }"""
        )
        page.locator(".person-sheet.is-expanded").wait_for()
        page.wait_for_timeout(430)
        expanded_geometry = page.locator(".person-sheet.is-expanded").evaluate(
            """sheet => {
                const box = sheet.getBoundingClientRect();
                return {bottom: box.bottom, viewportBottom: window.innerHeight};
            }"""
        )
        report["flow"]["person_sheet_swipes_to_full_profile"] = (
            page.locator(".person-sheet.is-expanded").count() == 1
            and page.get_by_text("过往项目", exact=True).is_visible()
            and page.get_by_text("协作方式", exact=True).is_visible()
            and page.get_by_text("系统推荐参考", exact=True).count() == 1
            and abs(expanded_geometry["bottom"] - expanded_geometry["viewportBottom"]) <= 1
        )
        assert report["flow"]["person_sheet_swipes_to_full_profile"]
        profile_scroll = page.locator(".person-sheet-content").evaluate(
            """content => {
                const before = content.scrollTop;
                content.scrollTop = content.scrollHeight;
                return {before, after: content.scrollTop, scrollHeight: content.scrollHeight, clientHeight: content.clientHeight};
            }"""
        )
        report["flow"]["full_profile_scrolls_independently"] = (
            profile_scroll["scrollHeight"] > profile_scroll["clientHeight"]
            and profile_scroll["after"] > profile_scroll["before"]
        )
        assert report["flow"]["full_profile_scrolls_independently"], profile_scroll
        live_radius = page.locator("[data-person-sheet-drag]").evaluate(
            """zone => {
                const box = zone.getBoundingClientRect();
                const x = box.left + box.width / 2;
                const startY = box.top + Math.min(box.height / 2, 28);
                zone.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, pointerId:10, clientX:x, clientY:startY}));
                zone.dispatchEvent(new PointerEvent('pointermove', {bubbles:true, pointerId:10, clientX:x, clientY:startY + 90}));
                const radius = parseFloat(getComputedStyle(zone.closest('.person-sheet')).borderTopLeftRadius);
                zone.dispatchEvent(new PointerEvent('pointerup', {bubbles:true, pointerId:10, clientX:x, clientY:startY + 90}));
                return radius;
            }"""
        )
        page.locator(".person-sheet.is-preview").wait_for()
        page.wait_for_timeout(380)
        preview_geometry = page.locator(".person-sheet.is-preview").evaluate(
            """sheet => {
                const box = sheet.getBoundingClientRect();
                return {bottom: box.bottom, viewportBottom: window.innerHeight};
            }"""
        )
        report["flow"]["full_profile_top_swipe_returns_to_discovery_sheet"] = (
            page.locator(".person-sheet.is-preview").count() == 1
            and live_radius > 0
            and abs(preview_geometry["bottom"] - preview_geometry["viewportBottom"]) <= 1
        )
        assert report["flow"]["full_profile_top_swipe_returns_to_discovery_sheet"]
        page.get_by_role("button", name="想认识", exact=True).click()
        page.get_by_role("button", name="模拟碰卡直连").click()
        page.screenshot(path=str(OUTPUT_DIR / "step-2-card-handshake.png"), full_page=True)
        page.get_by_role("button", name="模拟双方主动碰卡").click()
        page.screenshot(path=str(OUTPUT_DIR / "step-3-connected.png"), full_page=True)
        page.get_by_role("button", name="邀请加入「离线会议洞察终端」").click()
        report["flow"]["team_invite_requires_recipient_confirmation"] = page.get_by_text(
            "对方确认前不会被写入团队，也不会被分配任务。",
            exact=True,
        ).is_visible()
        assert report["flow"]["team_invite_requires_recipient_confirmation"]
        page.get_by_role("button", name="模拟对方确认加入").click()
        page.screenshot(path=str(OUTPUT_DIR / "step-4-team-joined.png"), full_page=True)
        page.get_by_role("button", name="进入项目启动舱").click()
        report["flow"]["launch_room_created"] = page.locator(".workspace-view").is_visible()
        report["flow"]["mobile_launch_progress_visible"] = page.locator(
            ".workspace-launch-track"
        ).is_visible()
        report["flow"]["mobile_starts_with_one_clear_action"] = page.get_by_role(
            "button", name="查看并确认分工"
        ).is_visible()
        report["flow"]["mobile_avoids_permission_dashboard"] = not page.locator(
            ".workspace-mobile-content .workspace-members"
        ).is_visible()
        assert report["flow"]["launch_room_created"]
        assert report["flow"]["mobile_launch_progress_visible"]
        assert report["flow"]["mobile_starts_with_one_clear_action"]
        assert report["flow"]["mobile_avoids_permission_dashboard"]
        page.get_by_role("button", name="查看并确认分工").click()
        report["flow"]["human_confirmation_required"] = page.get_by_text(
            "Agent 只能提出建议。每位成员都可以认领真正想做的部分，最终选择权交给人。",
            exact=True,
        ).is_visible()
        assert report["flow"]["human_confirmation_required"]
        page.locator(".workspace-mobile-content [data-action='reassign-task']").first.click()
        report["flow"]["human_can_override_agent"] = page.get_by_text(
            "关键路径 · 独立 · 当前负责人：周闻", exact=True
        ).first.is_visible()
        assert report["flow"]["human_can_override_agent"]
        page.locator(".workspace-mobile-content [data-action='confirm-workspace-plan']").click()
        report["flow"]["team_confirmed_plan"] = page.get_by_text("团队已确认启动方案", exact=True).first.is_visible()
        assert report["flow"]["team_confirmed_plan"]
        page.locator(".workspace-tabs [data-section='tasks']").click()
        page.locator(".workspace-mobile-content [data-task='hardware-choice']").click()
        task_accepted = "accepted" in (
            page.locator(".workspace-mobile-content [data-task='hardware-choice']").get_attribute("class") or ""
        )
        page.wait_for_timeout(260)
        page.screenshot(path=str(OUTPUT_DIR / "flow-complete.png"), full_page=True)
        page.locator(".workspace-tabs [data-section='overview']").click()
        report["flow"]["launched_mobile_state_visible"] = page.get_by_text(
            "项目已经正式启动", exact=True
        ).is_visible()
        assert report["flow"]["launched_mobile_state_visible"]
        page.get_by_role("button", name="发起项目 SOS").click()
        report["flow"]["project_sos_visible"] = page.get_by_text("SOS 已发布", exact=True).is_visible()
        assert report["flow"]["project_sos_visible"]
        page.wait_for_timeout(260)
        page.screenshot(path=str(OUTPUT_DIR / "workspace-mobile.png"), full_page=True)
        assert_mobile_visual_baseline(page, report["visual_baseline"], "workspace_mobile")

        report["flow"] = {
            **report["flow"],
            "project_title_visible": page.get_by_text("离线会议洞察终端", exact=True).is_visible(),
            "task_accepted": task_accepted,
            "state_label": page.locator(".state-ledger strong").text_content() if page.locator(".state-ledger strong").count() else "hidden-on-mobile",
        }

        page.locator(".app-nav [data-tab='profile']").click()
        report["flow"]["profile_has_floating_settings"] = page.locator(
            ".profile-settings-trigger"
        ).is_visible()
        report["flow"]["platform_links_use_input_rows"] = (
            page.locator(".platform-connect-list .platform-connect-row").count() == 7
            and page.locator(".platform-connect-list input").count() == 7
            and page.locator(".platform-connect-grid").count() == 0
        )
        report["flow"]["device_privacy_moved_off_profile"] = not page.locator(
            ".profile-fields"
        ).get_by_text("设备与隐私", exact=True).is_visible()
        settings_top = page.locator(".profile-settings-trigger").evaluate(
            "button => button.getBoundingClientRect().top"
        )
        page.locator(".screen").evaluate("screen => { screen.scrollTop = 700; }")
        page.wait_for_timeout(180)
        sticky_settings_top = page.evaluate(
            "document.querySelector('.profile-settings-trigger').getBoundingClientRect().top"
        )
        report["flow"]["profile_settings_remains_floating"] = (
            abs(sticky_settings_top - settings_top) < 1
        )
        page.locator(".screen").evaluate("screen => { screen.scrollTop = 0; }")
        assert report["flow"]["profile_has_floating_settings"]
        assert report["flow"]["platform_links_use_input_rows"]
        assert report["flow"]["device_privacy_moved_off_profile"]
        assert report["flow"]["profile_settings_remains_floating"]
        assert_mobile_visual_baseline(page, report["visual_baseline"], "profile")
        page.locator(".profile-settings-trigger").click()
        report["flow"]["settings_sheet_contains_device_privacy"] = (
            page.locator(".profile-settings-sheet").is_visible()
            and page.locator(".profile-settings-sheet").get_by_text(
                "设备与隐私", exact=True
            ).is_visible()
        )
        assert report["flow"]["settings_sheet_contains_device_privacy"]
        assert_mobile_visual_baseline(
            page, report["visual_baseline"], "profile_settings"
        )
        page.screenshot(
            path=str(OUTPUT_DIR / "profile-settings.png"), full_page=True
        )
        page.get_by_role("button", name="返回我的页面").click()
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

        workspace_desktop = browser.new_page(viewport={"width": 1440, "height": 900})
        workspace_desktop.on("console", lambda msg: report["errors"].append(f"workspace-console:{msg.type}:{msg.text}") if msg.type == "error" else None)
        workspace_desktop.on("pageerror", lambda error: report["errors"].append(f"workspace-page:{error}"))
        workspace_desktop.goto(f"{BASE_URL}/?variant=A&workspace=1")
        workspace_desktop.wait_for_load_state("networkidle")
        report["flow"]["desktop_workspace_is_primary"] = workspace_desktop.locator(".workspace-desktop-grid").is_visible()
        report["flow"]["desktop_workspace_has_three_zones"] = workspace_desktop.locator(".desktop-workspace-panel").count() == 3
        report["flow"]["desktop_workspace_hands_off_to_tools"] = (
            workspace_desktop.locator(".workspace-desktop-grid").get_by_role("button", name="飞书").is_visible()
            and workspace_desktop.locator(".workspace-desktop-grid").get_by_role("button", name="GitHub").is_visible()
        )
        assert report["flow"]["desktop_workspace_is_primary"]
        assert report["flow"]["desktop_workspace_has_three_zones"]
        assert report["flow"]["desktop_workspace_hands_off_to_tools"]
        workspace_desktop.screenshot(path=str(OUTPUT_DIR / "workspace-desktop.png"), full_page=True)
        workspace_desktop.close()

        browser.close()

    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
