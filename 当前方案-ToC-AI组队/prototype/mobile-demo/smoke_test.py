"""PROTOTYPE smoke test for the mobile demo."""

import json
import urllib.parse
from io import BytesIO
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:4173"
HOSTED_LIVE_ORIGIN = "https://cospan-live.test"
OUTPUT_DIR = Path(__file__).with_name("artifacts")


def fulfill_hosted_live_request(route):
    """Serve the product shell on a production-like HTTPS origin."""
    parsed = urllib.parse.urlparse(route.request.url)
    if parsed.path == "/api/auth/oauth/providers":
        route.fulfill(
            status=200,
            content_type="application/json",
            body='{"providers":{"google":{"enabled":false,"android_enabled":false},"wechat":{"enabled":false,"android_enabled":false}}}',
        )
        return
    relative_path = urllib.parse.unquote(parsed.path.lstrip("/")) or "index.html"
    target = (Path(__file__).parent / relative_path).resolve()
    if target.is_file() and Path(__file__).parent.resolve() in target.parents:
        route.fulfill(path=target)
        return
    route.fulfill(status=404, body="not found")


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
            const typeExclusions = '.demo-badge, .onboarding-eink';
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


def recommendation_layout_geometry(page, text_scale: float = 1.0) -> dict:
    """Measure the fixed recommendation viewport with realistic safe-area insets."""
    return page.locator(".phone-shell").evaluate(
        """(shell, scale) => {
            shell.style.setProperty('--rally-safe-area-top', '47px');
            shell.style.setProperty('--rally-safe-area-bottom', '27px');
            if (scale !== 1) {
                shell.querySelectorAll('.recommendation-view *').forEach(element => {
                    const size = parseFloat(getComputedStyle(element).fontSize);
                    if (size) element.style.fontSize = `${size * scale}px`;
                });
            }
            const screen = shell.querySelector('.screen');
            const card = shell.querySelector('.recommendation-card-active');
            const footer = card.querySelector(':scope > footer');
            const actions = shell.querySelector('.recommendation-actions');
            const nav = shell.querySelector('.app-nav');
            const rect = element => element.getBoundingClientRect();
            screen.scrollTop = screen.scrollHeight;
            card.scrollTop = card.scrollHeight;
            return {
                screenClientHeight: screen.clientHeight,
                screenScrollHeight: screen.scrollHeight,
                screenScrollTop: screen.scrollTop,
                cardHeight: rect(card).height,
                cardClientHeight: card.clientHeight,
                cardScrollHeight: card.scrollHeight,
                cardScrollTop: card.scrollTop,
                cardFooterInset: rect(card).bottom - rect(footer).bottom,
                cardActionGap: rect(actions).top - rect(card).bottom,
                actionNavGap: rect(nav).top - rect(actions).bottom,
                bodyScrollWidth: document.body.scrollWidth,
                viewportWidth: innerWidth,
            };
        }""",
        text_scale,
    )


def dispatch_recommendation_swipe(page, delta_x: int, pointer_id: int):
    """Dispatch one deterministic swipe gesture against the active recommendation."""
    page.locator(".recommendation-card-active").evaluate(
        """(card, gesture) => {
            const box = card.getBoundingClientRect();
            const startX = box.left + box.width / 2;
            const y = box.top + box.height / 2;
            const eventOptions = {bubbles: true, pointerId: gesture.pointerId, clientY: y};
            card.dispatchEvent(new PointerEvent('pointerdown', {...eventOptions, clientX: startX}));
            card.dispatchEvent(new PointerEvent('pointermove', {...eventOptions, clientX: startX + gesture.deltaX}));
            card.dispatchEvent(new PointerEvent('pointerup', {...eventOptions, clientX: startX + gesture.deltaX}));
        }""",
        {"deltaX": delta_x, "pointerId": pointer_id},
    )


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
        hosted_context = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=1,
            is_mobile=True,
            has_touch=True,
            ignore_https_errors=True,
        )
        hosted_page = hosted_context.new_page()
        hosted_page.route(f"{HOSTED_LIVE_ORIGIN}/**", fulfill_hosted_live_request)
        hosted_page.goto(f"{HOSTED_LIVE_ORIGIN}/?splash=0")
        hosted_page.get_by_role("heading", name="手机号登录").wait_for(timeout=3000)
        report["flow"]["hosted_entry_defaults_to_live"] = True
        hosted_context.close()

        layout_page = context.new_page()
        layout_page.goto(f"{BASE_URL}/?variant=A&splash=0")
        layout_page.wait_for_load_state("networkidle")
        navigation_padding = layout_page.locator(".phone-shell").evaluate(
            """shell => {
                shell.style.setProperty('--rally-safe-area-bottom', '27px');
                return parseFloat(getComputedStyle(shell.querySelector('.screen')).paddingBottom);
            }"""
        )
        assert navigation_padding >= 131

        layout_page.route(
            "**/api/analytics/events",
            lambda route: route.fulfill(status=202, content_type="application/json", body='{"accepted":0}'),
        )
        layout_page.goto(f"{BASE_URL}/?live=1&apiBase={BASE_URL}&splash=0")
        layout_page.wait_for_selector(".screen > .live-gate")
        live_gate_geometry = layout_page.locator(".phone-shell").evaluate(
            """shell => {
                shell.style.setProperty('--rally-safe-area-top', '47px');
                shell.style.setProperty('--rally-safe-area-bottom', '27px');
                const scrollArea = shell.querySelector('.screen');
                const gate = scrollArea.querySelector(':scope > .live-gate');
                const screenBox = scrollArea.getBoundingClientRect();
                const gateBox = gate.getBoundingClientRect();
                return {
                    uncoveredTop: gateBox.top - screenBox.top,
                    uncoveredBottom: screenBox.bottom - gateBox.bottom,
                    gatePaddingTop: parseFloat(getComputedStyle(gate).paddingTop),
                    scrollHeight: scrollArea.scrollHeight,
                    clientHeight: scrollArea.clientHeight,
                };
            }"""
        )
        report["visual_baseline"]["live_gate_covers_mobile_viewport"] = {
            **live_gate_geometry,
            "navigationPadding": navigation_padding,
        }
        assert abs(live_gate_geometry["uncoveredTop"]) <= 1
        assert abs(live_gate_geometry["uncoveredBottom"]) <= 1
        assert live_gate_geometry["gatePaddingTop"] >= 47
        assert live_gate_geometry["scrollHeight"] <= live_gate_geometry["clientHeight"] + 1
        toast_geometry = layout_page.evaluate(
            """() => {
                document.body.dataset.source = 'android-app';
                const toast = document.createElement('div');
                toast.className = 'toast';
                toast.textContent = '招呼已存在，等待对方回应';
                document.body.append(toast);
                const animation = toast.getAnimations()[0];
                animation.pause();
                animation.currentTime = 0;
                const enteringBox = toast.getBoundingClientRect();
                animation.currentTime = animation.effect.getTiming().duration;
                const settledBox = toast.getBoundingClientRect();
                const style = getComputedStyle(toast);
                const geometry = {
                    enteringTop: enteringBox.top,
                    settledTop: settledBox.top,
                    clientWidth: toast.clientWidth,
                    scrollWidth: toast.scrollWidth,
                    whiteSpace: style.whiteSpace,
                    text: toast.textContent,
                };
                toast.remove();
                return geometry;
            }"""
        )
        report["visual_baseline"]["android_toast_avoids_camera_cutout"] = toast_geometry
        assert toast_geometry["enteringTop"] >= 44, toast_geometry
        assert toast_geometry["settledTop"] >= 44, toast_geometry
        assert toast_geometry["whiteSpace"] == "nowrap", toast_geometry
        assert toast_geometry["scrollWidth"] <= toast_geometry["clientWidth"], toast_geometry
        layout_page.close()

        short_layout_page = context.new_page()
        short_layout_page.set_viewport_size({"width": 390, "height": 667})
        short_layout_page.goto(f"{BASE_URL}/?variant=A&splash=0", wait_until="networkidle")
        short_layout = recommendation_layout_geometry(short_layout_page)
        report["visual_baseline"]["short_recommendation_viewport"] = short_layout
        assert short_layout["screenScrollHeight"] <= short_layout["screenClientHeight"] + 1
        assert short_layout["screenScrollTop"] == 0
        assert short_layout["cardScrollHeight"] <= short_layout["cardClientHeight"] + 1
        assert short_layout["cardFooterInset"] >= 10
        assert short_layout["cardActionGap"] >= 16
        assert short_layout["actionNavGap"] >= 16
        assert short_layout["bodyScrollWidth"] <= short_layout["viewportWidth"]
        short_layout_page.close()

        large_text_page = context.new_page()
        large_text_page.goto(f"{BASE_URL}/?variant=A&splash=0", wait_until="networkidle")
        large_text_layout = recommendation_layout_geometry(large_text_page, text_scale=1.3)
        report["visual_baseline"]["large_text_recommendation_viewport"] = large_text_layout
        assert large_text_layout["screenScrollHeight"] <= large_text_layout["screenClientHeight"] + 1
        assert large_text_layout["screenScrollTop"] == 0
        assert large_text_layout["cardScrollHeight"] > large_text_layout["cardClientHeight"]
        assert large_text_layout["cardScrollTop"] > 0
        assert large_text_layout["cardFooterInset"] >= 10
        assert large_text_layout["cardActionGap"] >= 16
        assert large_text_layout["actionNavGap"] >= 16
        large_text_page.close()

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
                "scope": page.locator("body").get_attribute("data-scope"),
                "nav_buttons": page.locator(".app-nav button").count(),
                "collaboration_nav_uses_orchestration_icon": page.locator(
                    '.app-nav [data-tab="collaboration"] svg[data-nav-icon="orchestration"]'
                ).count() == 1,
                "discovery_tabs": page.locator(".discovery-tabs button").count(),
                "context_switchers": page.locator(".context-switch-trigger").count(),
                "context_label": page.locator(".context-switch-trigger").get_attribute("aria-label"),
                "prototype_switcher_removed": page.locator(".prototype-switcher").count() == 0,
                "fake_phone_status_removed": page.locator(".phone-status, .phone-island").count() == 0,
                "top_safe_area_reserved": page.locator(".screen").evaluate(
                    "element => parseFloat(getComputedStyle(element).paddingTop) >= 12"
                ),
                "nonzero_top_safe_area_applied": page.locator(".phone-shell").evaluate(
                    """shell => {
                        shell.style.setProperty('--rally-safe-area-top', '47px');
                        const applied = parseFloat(getComputedStyle(
                            shell.querySelector('.screen')
                        ).paddingTop) >= 47;
                        shell.style.removeProperty('--rally-safe-area-top');
                        return applied;
                    }"""
                ),
                "body_scroll_width": page.evaluate("document.body.scrollWidth"),
                "viewport_width": page.evaluate("window.innerWidth"),
            }
            assert report["variants"][variant]["nav_buttons"] == 4
            assert report["variants"][variant]["collaboration_nav_uses_orchestration_icon"]
            assert report["variants"][variant]["discovery_tabs"] == 3
            assert report["variants"][variant]["scope"] == "event"
            assert report["variants"][variant]["context_switchers"] == 1
            assert "She Nicest 2026" in report["variants"][variant]["context_label"]
            assert page.get_by_text("当前活动 · 2026", exact=True).count() == 0
            assert report["variants"][variant]["prototype_switcher_removed"]
            assert report["variants"][variant]["fake_phone_status_removed"]
            assert report["variants"][variant]["top_safe_area_reserved"]
            assert report["variants"][variant]["nonzero_top_safe_area_applied"]
            assert report["variants"][variant]["body_scroll_width"] <= report["variants"][variant]["viewport_width"]
            assert_mobile_visual_baseline(page, report["visual_baseline"], f"variant_{variant}")
            if variant == "A":
                report["variants"][variant]["active_recommendation_cards"] = page.locator(".recommendation-card-active").count()
                report["variants"][variant]["recommendation_progress_count"] = page.locator(".recommendation-progress i").count()
                report["variants"][variant]["persistent_swipe_hint_removed"] = (
                    page.locator(".recommendation-hint").count() == 0
                    and page.get_by_text("← 左滑暂不看", exact=True).count() == 0
                    and page.get_by_text("右滑想认识 →", exact=True).count() == 0
                )
                assert report["variants"][variant]["persistent_swipe_hint_removed"]
                recommendation_viewport = recommendation_layout_geometry(page)
                report["variants"][variant]["recommendation_stays_in_one_viewport"] = (
                    page.locator(".recommendation-boundary").count() == 0
                    and recommendation_viewport["screenScrollHeight"] <= recommendation_viewport["screenClientHeight"] + 1
                    and recommendation_viewport["screenScrollTop"] == 0
                )
                report["variants"][variant]["recommendation_card_has_safe_bottom_inset"] = (
                    recommendation_viewport["cardHeight"] >= 400
                    and recommendation_viewport["cardFooterInset"] >= 16
                    and recommendation_viewport["cardScrollHeight"] <= recommendation_viewport["cardClientHeight"]
                )
                report["variants"][variant]["recommendation_actions_have_breathing_room"] = (
                    recommendation_viewport["cardActionGap"] >= 16
                )
                report["variants"][variant]["table_like_lists_removed"] = (
                    page.locator(".role-roster-person, .person-row").count() == 0
                )
                assert report["variants"][variant]["active_recommendation_cards"] == 1
                assert report["variants"][variant]["recommendation_progress_count"] == 11
                assert report["variants"][variant]["recommendation_stays_in_one_viewport"], recommendation_viewport
                assert report["variants"][variant]["recommendation_card_has_safe_bottom_inset"], recommendation_viewport
                assert report["variants"][variant]["recommendation_actions_have_breathing_room"], recommendation_viewport
                assert report["variants"][variant]["table_like_lists_removed"]
            if variant == "B":
                discovery_backgrounds = page.locator(".phone-shell").evaluate(
                    """shell => {
                        shell.style.setProperty('--rally-safe-area-top', '47px');
                        shell.style.setProperty('--rally-safe-area-bottom', '27px');
                        const screen = shell.querySelector('.screen');
                        const view = screen.querySelector(':scope > .view-b');
                        return {
                            screen: getComputedStyle(screen).backgroundColor,
                            view: getComputedStyle(view).backgroundColor,
                        };
                    }"""
                )
                report["variants"][variant]["safe_areas_match_discovery_background"] = (
                    discovery_backgrounds["screen"] == discovery_backgrounds["view"]
                )
                assert report["variants"][variant]["safe_areas_match_discovery_background"], discovery_backgrounds
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
                report["variants"][variant]["directory_is_exhibition_scoped"] = (
                    page.get_by_text("展会名册", exact=True).is_visible()
                    and page.get_by_text("仅展示已授权加入本场展会的成员", exact=True).is_visible()
                )
                directory_geometry = page.locator(".directory-summary").evaluate(
                    """summary => {
                        const summaryBox = summary.getBoundingClientRect();
                        const firstPersonBox = document.querySelector('.ledger-person').getBoundingClientRect();
                        return {
                            height: summaryBox.height,
                            firstPersonOffset: firstPersonBox.top - summaryBox.top,
                        };
                    }"""
                )
                report["variants"][variant]["directory_header_is_compact"] = (
                    page.locator(".ledger-status, .ledger-rule").count() == 0
                    and directory_geometry["height"] <= 80
                    and directory_geometry["firstPersonOffset"] <= 100
                )

                assert report["variants"][variant]["ledger_people_count"] == 11
                assert report["variants"][variant]["directory_is_exhibition_scoped"]
                assert report["variants"][variant]["directory_header_is_compact"], directory_geometry
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

        page.goto(f"{BASE_URL}/?variant=A")
        discovery_header = page.locator(".app-header")
        report["flow"]["brand_lockup_only_appears_on_discovery"] = (
            discovery_header.locator(".app-brand").count() == 1
            and discovery_header.get_by_text("COSPAN", exact=True).is_visible()
            and discovery_header.get_by_text("合拍 · 发现", exact=True).is_visible()
        )
        assert report["flow"]["brand_lockup_only_appears_on_discovery"]
        for tab, title in (
            ("connections", "连接"),
            ("collaboration", "协作"),
            ("profile", "我的"),
        ):
            page.locator(f'.app-nav [data-tab="{tab}"]').click()
            section_header = page.locator(".app-header")
            assert section_header.locator(".app-brand").count() == 0
            assert section_header.locator(".app-section-title").get_by_text(
                title, exact=True
            ).is_visible()
            assert section_header.get_by_text("COSPAN", exact=True).count() == 0
        page.locator('.app-nav [data-tab="discover"]').click()
        page.get_by_role(
            "button", name="切换发现范围，当前为 She Nicest 2026"
        ).click()
        assert page.get_by_role("heading", name="你想在哪里发现人？").is_visible()
        assert page.get_by_text(
            "切换只影响发现结果，不会退出活动或删除关系。", exact=True
        ).is_visible()
        context_switcher_geometry = page.locator(".context-switcher-sheet").evaluate(
            """sheet => ({
                height: sheet.getBoundingClientRect().height,
                optionHeights: [...sheet.querySelectorAll('.context-option')]
                    .map(option => option.getBoundingClientRect().height),
                hasHorizontalOverflow: sheet.scrollWidth > sheet.clientWidth,
            })"""
        )
        report["flow"]["context_switcher_is_compact"] = (
            context_switcher_geometry["height"] <= 520
            and max(context_switcher_geometry["optionHeights"]) <= 76
            and not context_switcher_geometry["hasHorizontalOverflow"]
            and page.locator(".context-boundary-note").count() == 0
        )
        assert report["flow"]["context_switcher_is_compact"], context_switcher_geometry
        assert_mobile_visual_baseline(page, report["visual_baseline"], "context_switcher")
        page.locator('[data-context-scope="nearby"]').click()
        assert page.locator('body[data-scope="nearby"]').count() == 1
        assert page.locator("[data-discovery-view='C']").count() == 0
        assert urllib.parse.parse_qs(urllib.parse.urlparse(page.url).query)["scope"] == ["nearby"]
        assert page.evaluate("localStorage.getItem('cospan_discovery_context')") == "nearby"
        page.get_by_role("button", name="切换发现范围，当前为 日常附近").click()
        page.locator('[data-context-scope="event"]').click()
        assert page.locator('body[data-scope="event"]').count() == 1
        assert page.locator("[data-discovery-view='C']").count() == 1
        assert page.evaluate("localStorage.getItem('cospan_discovery_context')") == "event"
        report["flow"]["context_switcher_preserves_identity_across_scopes"] = True

        page.goto(f"{BASE_URL}/?variant=A")
        page.locator(".recommendation-card-active").click()
        assert urllib.parse.parse_qs(
            urllib.parse.urlparse(page.url).query
        )["overlay"] == ["person"]
        page.go_back()
        page.locator(".person-overlay").wait_for(state="detached")
        page.locator('.app-nav [data-tab="profile"]').click()
        assert urllib.parse.parse_qs(urllib.parse.urlparse(page.url).query)["view"] == ["profile"]
        page.locator('[data-action="open-profile-settings"]').click()
        assert urllib.parse.parse_qs(urllib.parse.urlparse(page.url).query)["overlay"] == ["profile-settings"]
        page.go_back()
        page.locator(".profile-settings-overlay").wait_for(state="detached")
        assert page.locator('body[data-tab="profile"]').count() == 1
        page.go_back()
        assert page.locator('body[data-tab="discover"]').count() == 1
        report["flow"]["browser_back_closes_overlay_before_leaving"] = True
        report["flow"]["major_view_is_reflected_in_url"] = True

        page.goto(f"{BASE_URL}/?variant=C&event=community-meetup")
        page.wait_for_load_state("networkidle")
        report["flow"]["directory_only_exists_for_enabled_exhibitions"] = (
            page.locator("body").get_attribute("data-variant") == "A"
            and page.locator("[data-discovery-view='C']").count() == 0
            and page.locator(".ledger-list").count() == 0
            and page.locator(".event-context").count() == 0
        )
        assert report["flow"]["directory_only_exists_for_enabled_exhibitions"]
        page.locator(".app-nav [data-tab='profile']").click()
        report["flow"]["non_exhibition_visibility_is_not_event_scoped"] = (
            page.get_by_text("附近可见", exact=True).is_visible()
            and page.get_by_text("展会内可见", exact=True).count() == 0
        )
        assert report["flow"]["non_exhibition_visibility_is_not_event_scoped"]

        page.goto(f"{BASE_URL}/?variant=A&build=hard-filters")
        page.wait_for_load_state("networkidle")
        page.get_by_role("button", name="设置筛选偏好").click()
        report["flow"]["discovery_filter_sheet_opens"] = page.get_by_text(
            "筛选偏好", exact=True
        ).is_visible()
        assert report["flow"]["discovery_filter_sheet_opens"]
        filter_surface = page.locator(".filter-setting-block").first.evaluate(
            """element => {
                const style = getComputedStyle(element);
                return {
                    borderLeftWidth: style.borderLeftWidth,
                    borderRadius: style.borderRadius,
                    backgroundColor: style.backgroundColor,
                };
            }"""
        )
        segment_surface = page.locator(".discovery-filter-segments").first.evaluate(
            """element => {
                const style = getComputedStyle(element);
                return {
                    backgroundColor: style.backgroundColor,
                    borderRadius: style.borderRadius,
                };
            }"""
        )
        report["flow"]["discovery_filters_use_flat_sections"] = (
            filter_surface["borderLeftWidth"] == "0px"
            and filter_surface["borderRadius"] == "0px"
            and filter_surface["backgroundColor"] == "rgba(0, 0, 0, 0)"
            and segment_surface["backgroundColor"] == "rgba(0, 0, 0, 0)"
            and segment_surface["borderRadius"] == "0px"
            and page.locator(".filter-impact").count() == 0
            and page.locator(".filter-setting-block header em").count() == 0
        )
        assert report["flow"]["discovery_filters_use_flat_sections"], {
            "filter": filter_surface,
            "segments": segment_surface,
        }
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
            "COSPAN 不会自动放宽你的筛选条件。调整状态、职能或投入时间后再查看。",
            exact=True,
        ).is_visible()
        assert report["flow"]["hard_filters_never_silently_relax"]

        page.goto(f"{BASE_URL}/?variant=A&workspace=1")
        page.wait_for_load_state("networkidle")
        page.locator(".app-nav [data-tab='discover']").click()
        page.locator("[data-action='dismiss-recommendation']").click()
        page.locator("[data-action='like-recommendation']").click()
        report["flow"]["interest_boundary_appears_after_action"] = page.get_by_text(
            "已表达想认识，线下碰卡后才会交换联系方式", exact=True
        ).is_visible()
        assert report["flow"]["interest_boundary_appears_after_action"]
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

        primary_conversation_entry = page.locator(".connection-conversation-entry")
        report["flow"]["connected_person_has_primary_conversation_entry"] = (
            primary_conversation_entry.count() == 1
            and primary_conversation_entry.get_by_text(
                "我想先把现场建联到开工的路径跑通。", exact=True
            ).is_visible()
            and primary_conversation_entry.get_attribute("data-connection-id") == "demo-lin"
        )
        assert report["flow"]["connected_person_has_primary_conversation_entry"]

        page.get_by_role("button", name="打开与 林澈 的对话", exact=True).click()
        conversation_geometry = page.locator(".direct-conversation").evaluate(
            """conversation => {
                const box = conversation.getBoundingClientRect();
                const composer = conversation.querySelector('.direct-conversation-composer').getBoundingClientRect();
                const controls = [...conversation.querySelectorAll('button, textarea')]
                    .map((element) => {
                        const control = element.getBoundingClientRect();
                        return {label: element.getAttribute('aria-label') || element.textContent.trim(), width: control.width, height: control.height};
                    });
                return {
                    top: box.top,
                    bottom: box.bottom,
                    width: box.width,
                    viewportHeight: window.innerHeight,
                    viewportWidth: window.innerWidth,
                    composerBottom: composer.bottom,
                    undersizedControls: controls.filter(({width, height}) => width < 44 || height < 44),
                };
            }"""
        )
        report["flow"]["direct_conversation_is_connection_scoped"] = (
            page.get_by_text("CONNECTED AT", exact=True).is_visible()
            and page.get_by_text("先聊清楚，再决定要不要开工。", exact=True).is_visible()
            and (
                page.get_by_role("button", name="澄清合作意图", exact=True).count()
                + page.get_by_role("button", name="进入共同协作", exact=True).count()
            ) == 1
        )
        report["flow"]["direct_conversation_fits_mobile_viewport"] = (
            conversation_geometry["top"] >= -1
            and conversation_geometry["bottom"] <= conversation_geometry["viewportHeight"] + 1
            and conversation_geometry["width"] <= conversation_geometry["viewportWidth"] + 1
            and conversation_geometry["composerBottom"] <= conversation_geometry["viewportHeight"] + 1
            and conversation_geometry["undersizedControls"] == []
        )
        assert report["flow"]["direct_conversation_is_connection_scoped"]
        assert report["flow"]["direct_conversation_fits_mobile_viewport"], conversation_geometry
        page.get_by_label("输入消息").fill("我们先把现场建联到开工的路径跑通。")
        page.get_by_role("button", name="发送消息").click()
        report["flow"]["direct_conversation_sends_lightweight_message"] = page.get_by_label(
            "与 林澈 的对话", exact=True
        ).get_by_text(
            "我们先把现场建联到开工的路径跑通。", exact=True
        ).is_visible()
        assert report["flow"]["direct_conversation_sends_lightweight_message"]
        page.screenshot(path=str(OUTPUT_DIR / "direct-conversation.png"), full_page=True)
        page.get_by_role("button", name="返回连接列表").click()

        page.locator(".app-nav [data-tab='discover']").click()
        page.locator("[data-discovery-view='C']").click()
        page.locator(".ledger-person[data-person='lin']").click()
        report["flow"]["connected_profile_has_message_entry"] = (
            page.get_by_role("button", name="发消息", exact=True).is_visible()
            and page.get_by_role("button", name="想认识", exact=True).count() == 0
        )
        assert report["flow"]["connected_profile_has_message_entry"]
        page.get_by_role("button", name="发消息", exact=True).click()
        assert page.get_by_label("与 林澈 的对话", exact=True).is_visible()
        page.get_by_role("button", name="返回连接列表").click()

        page.goto(f"{BASE_URL}/?variant=C&onboarding=1")
        page.wait_for_load_state("networkidle")
        report["flow"]["onboarding_starts_with_public_trails"] = page.get_by_text("不用从头自我介绍。", exact=True).is_visible()
        report["flow"]["discovery_tabs_hidden_during_onboarding"] = page.locator(".discovery-tabs").count() == 0
        assert_mobile_visual_baseline(page, report["visual_baseline"], "onboarding_public_trails")
        page.get_by_label("GitHub").fill("https://github.com/cospan-demo")
        page.get_by_role("button", name="下一步").click()
        page.get_by_label("作品或项目名称").fill("现场协作终端")
        page.get_by_label("公开链接 选填").fill("https://example.com/cospan")
        page.get_by_label("我做了什么").fill("负责产品流程和演示")
        page.get_by_label("今天可以投入多久").fill("今天可投入 6 小时")
        page.get_by_role("button", name="团队缺人").click()
        assert_mobile_visual_baseline(page, report["visual_baseline"], "onboarding_now_building")
        page.get_by_role("button", name="下一步").click()
        page.get_by_label("你怎么介绍自己的角色").fill("AI 产品与原型构建者")
        page.get_by_label("你会什么 3–5 项，用逗号分隔").fill("产品，交互，AI coding")
        page.get_by_label("你在关注什么").fill("Agent，现场协作")
        page.get_by_label("我的 builder's vibe 是").fill("把模糊想法快速做成可以真实体验的产品。")
        page.get_by_role("button", name="下一步").click()
        page.get_by_role("button", name="选择头像 2").click()
        page.get_by_label("怎么称呼你").fill("小雨")
        page.get_by_label("我确认将以上资料公开到本场展会；可以随时修改、暂停或撤回").check()
        report["flow"]["onboarding_card_preview_visible"] = page.locator("[data-onboarding-card-preview]").is_visible()
        report["flow"]["swipe_directions_only_taught_in_onboarding"] = page.get_by_text(
            "选择一个头像，确认公开预览。开始发现后，左滑暂不看，右滑表达想认识。以后可以随时在“我的”里修改或暂停展示。",
            exact=True,
        ).is_visible()
        assert report["flow"]["swipe_directions_only_taught_in_onboarding"]
        assert_mobile_visual_baseline(page, report["visual_baseline"], "onboarding_preview")
        page.wait_for_timeout(350)
        page.screenshot(path=str(OUTPUT_DIR / "onboarding-eink-preview.png"), full_page=True)
        page.get_by_role("button", name="完成介绍 · 开始发现").click()
        report["flow"]["onboarding_enters_recommendations"] = (
            page.locator("body").get_attribute("data-flow") == "product"
            and page.locator("body").get_attribute("data-variant") == "A"
        )
        page.locator(".app-nav [data-tab='profile']").click()
        report["flow"]["published_passport_is_visible"] = "is-hidden" not in (
            page.locator(".demo-badge").get_attribute("class") or ""
        )
        assert report["flow"]["published_passport_is_visible"]

        page.goto(f"{BASE_URL}/?variant=C&onboarding=1")
        page.wait_for_load_state("networkidle")
        page.get_by_role("button", name="暂且跳过").click()
        page.get_by_role("button", name="之后再放").click()
        page.get_by_role("button", name="暂且跳过").click()
        report["flow"]["onboarding_cannot_skip_required_identity"] = (
            page.get_by_role("heading", name="最后，让队友知道怎么称呼你。").is_visible()
            and page.locator(".app-nav").count() == 0
            and page.get_by_role("button", name="返回修改").is_visible()
        )
        assert report["flow"]["onboarding_cannot_skip_required_identity"]

        page.goto(f"{BASE_URL}/?variant=A")
        page.wait_for_load_state("networkidle")
        page.locator("[data-discovery-view='B']").click()
        report["flow"]["discovery_tabs_reach_nearby"] = page.locator("body").get_attribute("data-variant") == "B"
        assert report["flow"]["discovery_tabs_reach_nearby"]

        page.goto(f"{BASE_URL}/?variant=A")
        page.wait_for_load_state("networkidle")
        page.evaluate(
            """() => {
                window.__rallyAudioLog = {contexts: 0, closed: 0, suspended: 0, oscillators: []};
                class FakeAudioParam {
                    constructor(record = null) { this.record = record; }
                    setValueAtTime(value) {
                        if (this.record && this.record.start === undefined) this.record.start = value;
                    }
                    exponentialRampToValueAtTime(value) {
                        if (this.record) this.record.end = value;
                    }
                }
                class FakeAudioNode {
                    connect() { return this; }
                    start() {}
                    stop() {}
                }
                class FakeAudioContext {
                    constructor() {
                        window.__rallyAudioLog.contexts += 1;
                        this.currentTime = 1;
                        this.sampleRate = 48000;
                        this.state = 'running';
                        this.destination = new FakeAudioNode();
                    }
                    createGain() {
                        const node = new FakeAudioNode();
                        node.gain = new FakeAudioParam();
                        return node;
                    }
                    createOscillator() {
                        const record = {};
                        window.__rallyAudioLog.oscillators.push(record);
                        const node = new FakeAudioNode();
                        node.frequency = new FakeAudioParam(record);
                        return node;
                    }
                    createBiquadFilter() {
                        const node = new FakeAudioNode();
                        node.frequency = new FakeAudioParam();
                        node.Q = new FakeAudioParam();
                        return node;
                    }
                    createBuffer(_channels, length) {
                        const samples = new Float32Array(length);
                        return {getChannelData: () => samples};
                    }
                    createBufferSource() { return new FakeAudioNode(); }
                    resume() { this.state = 'running'; return Promise.resolve(); }
                    suspend() {
                        this.state = 'suspended';
                        window.__rallyAudioLog.suspended += 1;
                        return Promise.resolve();
                    }
                    close() {
                        this.state = 'closed';
                        window.__rallyAudioLog.closed += 1;
                        return Promise.resolve();
                    }
                }
                window.AudioContext = FakeAudioContext;
            }"""
        )
        dispatch_recommendation_swipe(page, delta_x=30, pointer_id=6)
        report["flow"]["subthreshold_swipe_is_silent"] = page.evaluate(
            "window.__rallyAudioLog.oscillators.length === 0"
        )
        assert report["flow"]["subthreshold_swipe_is_silent"]
        first_recommendation = page.locator(".recommendation-person h3").inner_text()
        dispatch_recommendation_swipe(page, delta_x=110, pointer_id=7)
        page.wait_for_timeout(260)
        report["flow"]["right_swipe_advances_recommendation"] = (
            page.locator(".recommendation-person h3").inner_text() != first_recommendation
            and page.locator(".recommendation-intro em").inner_text() == "2 / 11"
        )
        assert report["flow"]["right_swipe_advances_recommendation"]

        second_recommendation = page.locator(".recommendation-person h3").inner_text()
        dispatch_recommendation_swipe(page, delta_x=-110, pointer_id=8)
        page.wait_for_timeout(260)
        swipe_audio_profile = page.evaluate(
            """() => ({
                contexts: window.__rallyAudioLog.contexts,
                oscillatorCount: window.__rallyAudioLog.oscillators.length,
                rightStart: window.__rallyAudioLog.oscillators[0]?.start,
                rightEnd: window.__rallyAudioLog.oscillators[0]?.end,
                leftStart: window.__rallyAudioLog.oscillators[2]?.start,
                leftEnd: window.__rallyAudioLog.oscillators[2]?.end,
            })"""
        )
        report["flow"]["left_swipe_advances_recommendation"] = (
            page.locator(".recommendation-person h3").inner_text() != second_recommendation
            and page.locator(".recommendation-intro em").inner_text() == "3 / 11"
        )
        report["flow"]["swipe_sounds_are_directional_and_single_fire"] = (
            swipe_audio_profile["contexts"] == 1
            and swipe_audio_profile["oscillatorCount"] == 4
            and swipe_audio_profile["rightEnd"] > swipe_audio_profile["rightStart"]
            and swipe_audio_profile["leftEnd"] < swipe_audio_profile["leftStart"]
        )
        assert report["flow"]["left_swipe_advances_recommendation"]
        assert report["flow"]["swipe_sounds_are_directional_and_single_fire"], swipe_audio_profile

        page.locator(".app-nav [data-tab='profile']").click()
        page.locator(".profile-settings-trigger").click()
        sound_toggle = page.locator("[data-action='toggle-swipe-sound']")
        report["flow"]["swipe_sound_setting_defaults_on"] = (
            sound_toggle.get_attribute("aria-pressed") == "true"
        )
        assert report["flow"]["swipe_sound_setting_defaults_on"]
        sound_toggle.click()
        report["flow"]["swipe_sound_setting_persists_off"] = (
            sound_toggle.get_attribute("aria-pressed") == "false"
            and page.evaluate("localStorage.getItem('rally_swipe_sound_enabled')") == "false"
        )
        report["flow"]["swipe_sound_disable_releases_audio"] = page.evaluate(
            "window.__rallyAudioLog.closed === 1"
        )
        assert report["flow"]["swipe_sound_setting_persists_off"]
        assert report["flow"]["swipe_sound_disable_releases_audio"]
        page.get_by_role("button", name="返回我的页面").click()
        page.locator(".app-nav [data-tab='discover']").click()
        page.evaluate("window.__rallyAudioLog.oscillators = []")
        dispatch_recommendation_swipe(page, delta_x=110, pointer_id=11)
        page.wait_for_timeout(260)
        report["flow"]["disabled_swipe_sound_is_silent"] = page.evaluate(
            "window.__rallyAudioLog.oscillators.length === 0"
        )
        assert report["flow"]["disabled_swipe_sound_is_silent"]
        page.locator(".app-nav [data-tab='profile']").click()
        page.locator(".profile-settings-trigger").click()
        page.locator("[data-action='toggle-swipe-sound']").click()
        report["flow"]["swipe_sound_setting_restores_on"] = (
            page.locator("[data-action='toggle-swipe-sound']").get_attribute("aria-pressed") == "true"
            and page.evaluate("localStorage.getItem('rally_swipe_sound_enabled')") == "true"
        )
        assert report["flow"]["swipe_sound_setting_restores_on"]

        page.goto(f"{BASE_URL}/?variant=A")
        page.wait_for_load_state("networkidle")
        page.locator(".recommendation-card-active").click()
        report["flow"]["person_preview_shows_authored_bio_not_agent_summary"] = (
            page.get_by_text("本人简介", exact=True).is_visible()
            and page.get_by_text("原文", exact=True).is_visible()
            and page.locator(".person-sheet.is-preview").count() == 1
            and page.locator(".participant-bio p").inner_text() != page.locator(".ai-reference > p:not(.micro-label)").inner_text()
        )
        assert report["flow"]["person_preview_shows_authored_bio_not_agent_summary"]
        report["flow"]["full_profile_content_preloaded_before_drag"] = (
            page.locator("[data-person-full-profile]").count() == 1
            and page.get_by_text("过往项目", exact=True).count() == 1
            and page.get_by_text("协作方式", exact=True).count() == 1
            and not page.locator("[data-person-full-profile]").is_visible()
        )
        assert report["flow"]["full_profile_content_preloaded_before_drag"]
        assert_mobile_visual_baseline(page, report["visual_baseline"], "person_detail_sheet")
        page.screenshot(path=str(OUTPUT_DIR / "step-1-match-reason.png"), full_page=True)
        expanding_drag_geometry = page.locator("[data-person-sheet-drag]").evaluate(
            """zone => {
                const box = zone.getBoundingClientRect();
                const x = box.left + box.width / 2;
                const startY = box.top + Math.min(box.height / 2, 28);
                zone.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, pointerId:9, clientX:x, clientY:startY}));
                zone.dispatchEvent(new PointerEvent('pointermove', {bubbles:true, pointerId:9, clientX:x, clientY:startY - 80}));
                const sheetBox = zone.closest('.person-sheet').getBoundingClientRect();
                zone.dispatchEvent(new PointerEvent('pointerup', {bubbles:true, pointerId:9, clientX:x, clientY:startY - 80}));
                return {bottom: sheetBox.bottom, viewportBottom: window.innerHeight};
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
            and page.locator(".person-sheet-nav button").count() == 0
            and abs(expanding_drag_geometry["bottom"] - expanding_drag_geometry["viewportBottom"]) <= 1
            and abs(expanded_geometry["bottom"] - expanded_geometry["viewportBottom"]) <= 1
        )
        assert report["flow"]["person_sheet_swipes_to_full_profile"]
        detail_module_backgrounds = page.locator(
            ".collaboration-style, .evidence-section, .ai-reference"
        ).evaluate_all(
            "elements => elements.map(element => getComputedStyle(element).backgroundColor)"
        )
        report["flow"]["person_detail_modules_share_neutral_surface"] = (
            detail_module_backgrounds == ["rgb(245, 246, 242)"] * 3
        )
        assert report["flow"]["person_detail_modules_share_neutral_surface"]
        page.locator(".person-sheet-content").evaluate(
            """surface => {
                const box = surface.getBoundingClientRect();
                const startX = box.left + box.width * .28;
                const y = box.top + Math.min(160, box.height / 2);
                surface.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, pointerId:11, clientX:startX, clientY:y}));
                surface.dispatchEvent(new PointerEvent('pointermove', {bubbles:true, pointerId:11, clientX:startX + 100, clientY:y + 3}));
                surface.dispatchEvent(new PointerEvent('pointerup', {bubbles:true, pointerId:11, clientX:startX + 100, clientY:y + 3}));
            }"""
        )
        page.locator(".person-overlay").wait_for(state="detached")
        report["flow"]["full_profile_right_swipe_returns_to_discovery"] = page.locator(".recommendation-card-active").is_visible()
        assert report["flow"]["full_profile_right_swipe_returns_to_discovery"]
        page.locator(".recommendation-card-active").click()
        page.locator("[data-action='expand-person']").click()
        page.locator(".person-sheet.is-expanded").wait_for()
        page.wait_for_timeout(430)
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
        collapsing_drag_geometry = page.locator("[data-person-sheet-drag]").evaluate(
            """zone => {
                const box = zone.getBoundingClientRect();
                const x = box.left + box.width / 2;
                const startY = box.top + Math.min(box.height / 2, 28);
                zone.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, pointerId:10, clientX:x, clientY:startY}));
                zone.dispatchEvent(new PointerEvent('pointermove', {bubbles:true, pointerId:10, clientX:x, clientY:startY + 90}));
                const sheet = zone.closest('.person-sheet');
                const sheetBox = sheet.getBoundingClientRect();
                const radius = parseFloat(getComputedStyle(sheet).borderTopLeftRadius);
                zone.dispatchEvent(new PointerEvent('pointerup', {bubbles:true, pointerId:10, clientX:x, clientY:startY + 90}));
                return {radius, bottom: sheetBox.bottom, viewportBottom: window.innerHeight};
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
            and collapsing_drag_geometry["radius"] > 0
            and abs(collapsing_drag_geometry["bottom"] - collapsing_drag_geometry["viewportBottom"]) <= 1
            and abs(preview_geometry["bottom"] - preview_geometry["viewportBottom"]) <= 1
        )
        assert report["flow"]["full_profile_top_swipe_returns_to_discovery_sheet"]
        page.locator(".person-sheet-content").evaluate(
            """surface => {
                const box = surface.getBoundingClientRect();
                const startX = box.left + box.width * .72;
                const y = box.top + Math.min(150, box.height / 2);
                surface.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, pointerId:12, clientX:startX, clientY:y}));
                surface.dispatchEvent(new PointerEvent('pointermove', {bubbles:true, pointerId:12, clientX:startX - 100, clientY:y + 2}));
                surface.dispatchEvent(new PointerEvent('pointerup', {bubbles:true, pointerId:12, clientX:startX - 100, clientY:y + 2}));
            }"""
        )
        page.locator(".person-overlay").wait_for(state="detached")
        report["flow"]["preview_left_swipe_returns_to_discovery"] = page.locator(".recommendation-card-active").is_visible()
        assert report["flow"]["preview_left_swipe_returns_to_discovery"]
        page.locator(".recommendation-card-active").click()
        page.get_by_role("button", name="想认识", exact=True).click()
        page.get_by_role("button", name="模拟碰卡直连").click()
        page.screenshot(path=str(OUTPUT_DIR / "step-2-card-handshake.png"), full_page=True)
        page.get_by_role("button", name="模拟双方主动碰卡").click()
        page.screenshot(path=str(OUTPUT_DIR / "step-3-connected.png"), full_page=True)
        report["flow"]["connection_enters_intent_clarification_first"] = (
            page.get_by_role("button", name="先聊一句", exact=True).is_visible()
            and page.get_by_role("button", name="进入意图澄清").is_visible()
            and page.get_by_role("button", name="邀请加入「离线会议洞察终端」").count() == 0
            and page.locator(".task-item").count() == 0
        )
        assert report["flow"]["connection_enters_intent_clarification_first"]
        page.get_by_role("button", name="进入意图澄清").click()
        report["flow"]["intent_alignment_is_human_led"] = page.get_by_text(
            "AI 只整理重合点和待确认问题，不替你们决定方向。",
            exact=True,
        ).is_visible()
        assert report["flow"]["intent_alignment_is_human_led"]
        assert page.locator(".task-item").count() == 0
        page.get_by_role("button", name="共同填写方向草案").click()
        direction_form = page.locator("[data-direction-form]")
        report["flow"]["direction_requires_three_human_inputs"] = (
            direction_form.locator("input[required]").count() == 3
            and not direction_form.evaluate("form => form.checkValidity()")
        )
        assert report["flow"]["direction_requires_three_human_inputs"]
        page.get_by_label("服务谁").fill("   ")
        page.get_by_label("解决什么问题").fill("   ")
        page.get_by_label("验证什么结果").fill("   ")
        page.get_by_role("button", name="确认我的方向草案").click()
        report["flow"]["direction_rejects_whitespace_only"] = (
            direction_form.is_visible()
            and page.get_by_text("周闻 · 已确认", exact=True).count() == 0
        )
        assert report["flow"]["direction_rejects_whitespace_only"]
        page.get_by_label("服务谁").fill("线下黑客松参与者")
        page.get_by_label("解决什么问题").fill("现场组队方向迟迟无法收敛")
        page.get_by_label("验证什么结果").fill("15 分钟内形成双方确认的项目方向")
        page.get_by_role("button", name="确认我的方向草案").click()
        report["flow"]["first_confirmation_keeps_partner_pending"] = (
            page.get_by_text("周闻 · 已确认", exact=True).is_visible()
            and page.get_by_text("林澈 · 待确认", exact=True).is_visible()
            and page.get_by_role("button", name="创建项目并邀请入队").count() == 0
            and page.locator(".task-item").count() == 0
        )
        assert report["flow"]["first_confirmation_keeps_partner_pending"]
        page.get_by_role("button", name="稍后继续").click()
        report["flow"]["direction_progress_can_resume_from_connection"] = page.get_by_role(
            "button", name="查看方向确认进度"
        ).is_visible()
        assert report["flow"]["direction_progress_can_resume_from_connection"]
        page.get_by_role("button", name="查看方向确认进度").click()
        assert page.get_by_text("林澈 · 待确认", exact=True).is_visible()
        page.get_by_role("button", name="模拟林澈确认方向").click()
        report["flow"]["project_gate_opens_only_after_both_confirm"] = (
            page.get_by_text("方向已由双方确认", exact=True).is_visible()
            and page.locator("[data-action='invite-team']").is_visible()
        )
        assert report["flow"]["project_gate_opens_only_after_both_confirm"]
        page.get_by_role("button", name="稍后创建").click()
        report["flow"]["confirmed_direction_can_resume_project_creation"] = page.get_by_role(
            "button", name="创建项目并邀请入队"
        ).is_visible()
        assert report["flow"]["confirmed_direction_can_resume_project_creation"]
        page.locator("[data-action='resume-project-creation']").click()
        page.locator("[data-action='invite-team']").click()
        report["flow"]["team_invite_requires_recipient_confirmation"] = page.get_by_text(
            "对方确认前不会被写入团队，也不会被分配任务。",
            exact=True,
        ).is_visible()
        assert report["flow"]["team_invite_requires_recipient_confirmation"]
        page.get_by_role("button", name="模拟对方确认加入").click()
        page.screenshot(path=str(OUTPUT_DIR / "step-4-team-joined.png"), full_page=True)
        page.get_by_role("button", name="进入人机协作空间").click()
        report["flow"]["launch_room_created"] = page.locator(".workspace-view").is_visible()
        report["flow"]["mobile_launch_progress_visible"] = page.locator(
            ".workspace-launch-summary[role='progressbar']"
        ).is_visible() and page.locator(
            ".workspace-launch-summary"
        ).get_attribute("aria-valuenow") == "2"
        report["flow"]["mobile_workspace_tabs_are_navigation"] = page.locator(
            ".workspace-tabs button"
        ).all_inner_texts() == ["概览", "任务", "记录"]
        report["flow"]["mobile_starts_with_one_clear_action"] = page.get_by_role(
            "button", name="查看分工建议"
        ).is_visible()
        report["flow"]["mobile_avoids_permission_dashboard"] = not page.locator(
            ".workspace-mobile-content .workspace-members"
        ).is_visible()
        assert report["flow"]["launch_room_created"]
        assert report["flow"]["mobile_launch_progress_visible"]
        assert report["flow"]["mobile_workspace_tabs_are_navigation"]
        assert report["flow"]["mobile_starts_with_one_clear_action"]
        assert report["flow"]["mobile_avoids_permission_dashboard"]
        page.get_by_role("button", name="查看分工建议").click()
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
        report["flow"]["profile_has_settings_button"] = page.locator(
            ".profile-settings-trigger"
        ).is_visible()
        visibility_toggle_geometry = page.locator("[data-action='toggle-visible']").evaluate(
            """button => {
                const hitBox = button.getBoundingClientRect();
                const track = button.querySelector('i');
                const trackBox = track.getBoundingClientRect();
                return {
                    hitWidth: hitBox.width,
                    hitHeight: hitBox.height,
                    trackWidth: trackBox.width,
                    trackHeight: trackBox.height,
                    buttonBackground: getComputedStyle(button).backgroundColor,
                    trackBackground: getComputedStyle(track).backgroundColor,
                };
            }"""
        )
        report["flow"]["visibility_toggle_uses_compact_visual_track"] = (
            visibility_toggle_geometry["hitWidth"] >= 44
            and visibility_toggle_geometry["hitHeight"] >= 44
            and visibility_toggle_geometry["trackWidth"] == 46
            and visibility_toggle_geometry["trackHeight"] == 28
            and visibility_toggle_geometry["buttonBackground"] == "rgba(0, 0, 0, 0)"
            and visibility_toggle_geometry["trackBackground"] == "rgb(52, 124, 248)"
        )
        demo_display = page.locator(".demo-badge")
        display_ratio = demo_display.evaluate(
            "element => element.getBoundingClientRect().width / element.getBoundingClientRect().height"
        )
        report["flow"]["demo_display_matches_esp32_8048s043"] = (
            page.get_by_text("ESP32-8048S043", exact=True).is_visible()
            and page.get_by_text("480 × 800", exact=True).is_visible()
            and demo_display.get_attribute("data-orientation") == "portrait"
            and 0.58 <= display_ratio <= 0.62
            and demo_display.locator(".fake-qr").count() == 0
        )
        demo_display.screenshot(path=str(OUTPUT_DIR / "esp32-8048s043-portrait.png"))
        page.locator(".screen").evaluate("screen => { screen.scrollTop = 0; }")
        report["flow"]["platform_links_use_input_rows"] = (
            page.locator(".platform-connect-list .platform-connect-row").count() == 7
            and page.locator(".platform-connect-list input").count() == 7
            and page.locator(".platform-connect-grid").count() == 0
        )
        platform_style = page.evaluate(
            """() => {
                const panel = getComputedStyle(document.querySelector('.platform-links-panel'));
                const shell = getComputedStyle(document.querySelector('.platform-input-shell'));
                const save = getComputedStyle(document.querySelector('.platform-save-button'));
                return {
                    panelBorder: parseFloat(panel.borderTopWidth),
                    panelBackground: panel.backgroundColor,
                    shellTop: parseFloat(shell.borderTopWidth),
                    shellRight: parseFloat(shell.borderRightWidth),
                    shellBottom: parseFloat(shell.borderBottomWidth),
                    shellLeft: parseFloat(shell.borderLeftWidth),
                    shellRadius: parseFloat(shell.borderTopLeftRadius),
                    shellShadow: shell.boxShadow,
                    saveBackground: save.backgroundColor,
                };
            }"""
        )
        report["flow"]["platform_links_use_minimal_lines"] = (
            platform_style["panelBorder"] == 0
            and platform_style["panelBackground"] == "rgba(0, 0, 0, 0)"
            and platform_style["shellTop"] == 0
            and platform_style["shellRight"] == 0
            and platform_style["shellBottom"] > 0
            and platform_style["shellLeft"] == 0
            and platform_style["shellRadius"] == 0
            and platform_style["shellShadow"] == "none"
            and platform_style["saveBackground"] == "rgba(0, 0, 0, 0)"
        )
        logout_action_style = page.evaluate(
            """() => {
                const button = document.createElement('button');
                button.className = 'profile-logout-button';
                button.textContent = '退出当前账号';
                document.body.append(button);
                const style = getComputedStyle(button);
                const result = {
                    background: style.backgroundColor,
                    border: style.borderTopColor,
                    color: style.color,
                };
                button.remove();
                return result;
            }"""
        )
        report["flow"]["profile_logout_action_uses_neutral_colors"] = (
            logout_action_style
            == {
                "background": "rgb(255, 255, 255)",
                "border": "rgb(214, 221, 231)",
                "color": "rgb(23, 33, 45)",
            }
        )
        report["flow"]["device_privacy_moved_off_profile"] = not page.locator(
            ".profile-fields"
        ).get_by_text("设备与隐私", exact=True).is_visible()
        settings_top = page.locator(".profile-settings-trigger").evaluate(
            "button => button.getBoundingClientRect().top"
        )
        profile_header_position = page.locator(".profile-view .app-header").evaluate(
            "header => getComputedStyle(header).position"
        )
        page.locator(".screen").evaluate("screen => { screen.scrollTop = 700; }")
        page.wait_for_timeout(180)
        scrolled_settings_top = page.evaluate(
            "document.querySelector('.profile-settings-trigger').getBoundingClientRect().top"
        )
        report["flow"]["profile_header_scrolls_with_content"] = (
            profile_header_position not in ("sticky", "fixed")
            and scrolled_settings_top < settings_top - 300
        )
        page.locator(".screen").evaluate("screen => { screen.scrollTop = 0; }")
        assert report["flow"]["profile_has_settings_button"]
        assert report["flow"]["visibility_toggle_uses_compact_visual_track"], visibility_toggle_geometry
        assert report["flow"]["demo_display_matches_esp32_8048s043"], display_ratio
        assert report["flow"]["platform_links_use_input_rows"]
        assert report["flow"]["platform_links_use_minimal_lines"], platform_style
        assert report["flow"]["profile_logout_action_uses_neutral_colors"], logout_action_style
        assert report["flow"]["device_privacy_moved_off_profile"]
        assert report["flow"]["profile_header_scrolls_with_content"]
        assert_mobile_visual_baseline(page, report["visual_baseline"], "profile")
        page.locator(".profile-settings-trigger").click()
        report["flow"]["settings_sheet_contains_device_privacy"] = (
            page.locator(".profile-settings-sheet").is_visible()
            and page.locator(".profile-settings-sheet").get_by_text(
                "设备与隐私", exact=True
            ).is_visible()
        )
        report["flow"]["settings_sheet_contains_swipe_sound_toggle"] = (
            page.locator("[data-action='toggle-swipe-sound']").is_visible()
            and page.locator("[data-action='toggle-swipe-sound']").get_attribute("aria-pressed") == "true"
        )
        assert report["flow"]["settings_sheet_contains_device_privacy"]
        assert report["flow"]["settings_sheet_contains_swipe_sound_toggle"]
        assert_mobile_visual_baseline(
            page, report["visual_baseline"], "profile_settings"
        )
        page.screenshot(
            path=str(OUTPUT_DIR / "profile-settings.png"), full_page=True
        )
        page.get_by_role("button", name="返回我的页面").click()
        page.locator("[data-action='toggle-visible']").click()
        report["flow"]["visibility_paused"] = "is-hidden" in (page.locator(".demo-badge").get_attribute("class") or "")
        page.screenshot(path=str(OUTPUT_DIR / "profile-eink.png"), full_page=True)

        page.locator(".app-nav [data-tab='discover']").click()
        page.locator("[data-action='dismiss-recommendation']").click()
        page.locator(".recommendation-card-active").click()
        page.get_by_role("button", name="模拟碰卡直连").click()
        page.get_by_role("button", name="模拟双方主动碰卡").click()
        report["flow"]["created_project_skips_alignment_for_next_connection"] = (
            page.get_by_role(
                "button", name="邀请加入「离线会议洞察终端」"
            ).is_visible()
            and page.get_by_role("button", name="进入意图澄清").count() == 0
        )
        assert report["flow"]["created_project_skips_alignment_for_next_connection"]

        known_direction_page = browser.new_page(
            viewport={"width": 390, "height": 844},
            is_mobile=True,
            has_touch=True,
        )
        known_direction_page.goto(f"{BASE_URL}/?variant=A&onboarding=1")
        known_direction_page.wait_for_load_state("networkidle")
        known_direction_page.get_by_role("button", name="暂且跳过").click()
        known_direction_page.get_by_role("button", name="团队缺人").click()
        known_direction_page.get_by_role("button", name="之后再放").click()
        known_direction_page.get_by_label("你怎么介绍自己的角色").fill("产品构建者")
        known_direction_page.get_by_label("你会什么 3–5 项，用逗号分隔").fill("产品，交互，原型")
        known_direction_page.get_by_label("你在关注什么").fill("现场协作")
        known_direction_page.get_by_label("我的 builder's vibe 是").fill("先跑通真实闭环。")
        known_direction_page.get_by_role("button", name="下一步").click()
        known_direction_page.get_by_label("怎么称呼你").fill("周闻")
        known_direction_page.get_by_label(
            "我确认将以上资料公开到本场展会；可以随时修改、暂停或撤回"
        ).check()
        known_direction_page.get_by_role(
            "button", name="完成介绍 · 开始发现"
        ).click()
        known_direction_page.locator("[data-discovery-view='A']").click()
        known_direction_page.locator(".recommendation-card-active").click()
        known_direction_page.get_by_role(
            "button", name="模拟碰卡直连"
        ).click()
        known_direction_page.get_by_role(
            "button", name="模拟双方主动碰卡"
        ).click()
        report["flow"]["known_project_direction_can_skip_alignment"] = (
            known_direction_page.get_by_role(
                "button", name="邀请加入「离线会议洞察终端」"
            ).is_visible()
            and known_direction_page.get_by_role(
                "button", name="进入意图澄清"
            ).count() == 0
        )
        assert report["flow"]["known_project_direction_can_skip_alignment"]
        known_direction_page.get_by_role("button", name="稍后处理").click()
        report["flow"]["known_project_resumes_direct_invitation"] = (
            known_direction_page.get_by_role(
                "button", name="邀请加入现有项目"
            ).is_visible()
        )
        assert report["flow"]["known_project_resumes_direct_invitation"]
        known_direction_page.get_by_role(
            "button", name="邀请加入现有项目"
        ).click()
        assert known_direction_page.get_by_role(
            "button", name="邀请加入「离线会议洞察终端」"
        ).is_visible()
        assert known_direction_page.get_by_text(
            "方向已由双方确认", exact=True
        ).count() == 0
        known_direction_page.close()

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
        report["flow"]["desktop_connected_member_has_private_chat"] = workspace_desktop.locator(
            ".workspace-desktop-grid"
        ).get_by_role("button", name="私聊 林澈", exact=True).is_visible()
        assert report["flow"]["desktop_workspace_is_primary"]
        assert report["flow"]["desktop_workspace_has_three_zones"]
        assert report["flow"]["desktop_workspace_hands_off_to_tools"]
        assert report["flow"]["desktop_connected_member_has_private_chat"]
        workspace_desktop.locator(".workspace-desktop-grid").get_by_role(
            "button", name="私聊 林澈", exact=True
        ).click()
        assert workspace_desktop.get_by_label("与 林澈 的对话", exact=True).is_visible()
        workspace_desktop.get_by_role("button", name="返回连接列表").click()
        workspace_desktop.screenshot(path=str(OUTPUT_DIR / "workspace-desktop.png"), full_page=True)
        workspace_desktop.close()

        compact_desktop = browser.new_page(viewport={"width": 877, "height": 783})
        compact_desktop.goto(f"{BASE_URL}/?variant=A&workspace=1")
        compact_desktop.wait_for_load_state("networkidle")
        compact_desktop_layout = compact_desktop.evaluate(
            """() => ({
                desktopVisible: getComputedStyle(document.querySelector('.workspace-desktop-grid')).display === 'grid',
                mobileVisible: getComputedStyle(document.querySelector('.workspace-mobile-content')).display !== 'none',
                fitsWidth: document.body.scrollWidth <= window.innerWidth,
                zones: document.querySelectorAll('.desktop-workspace-panel').length,
            })"""
        )
        report["flow"]["compact_pc_uses_desktop_workspace"] = (
            compact_desktop_layout["desktopVisible"]
            and not compact_desktop_layout["mobileVisible"]
            and compact_desktop_layout["fitsWidth"]
            and compact_desktop_layout["zones"] == 3
        )
        assert report["flow"]["compact_pc_uses_desktop_workspace"], compact_desktop_layout
        compact_desktop.close()

        page.goto(f"{BASE_URL}/?variant=A")
        page.evaluate("() => navigator.serviceWorker.ready")
        page.reload(wait_until="networkidle")
        assert page.evaluate("Boolean(navigator.serviceWorker.controller)")
        context.set_offline(True)
        try:
            page.goto(f"{BASE_URL}/?variant=A", wait_until="domcontentloaded")
            page.locator(".app-nav").wait_for(timeout=4000)
            report["flow"]["pwa_shell_opens_offline"] = True
        finally:
            context.set_offline(False)

        browser.close()

    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
