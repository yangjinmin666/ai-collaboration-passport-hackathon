"""Focused regression test for the COSPAN launch animation."""

from pathlib import Path

from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:4173"
OUTPUT_PATH = Path(__file__).with_name("artifacts") / "splash.png"


def assert_slogan_stays_inside_room(page):
    geometry = page.evaluate(
        """() => {
            const room = document.querySelector('.rally-splash-room').getBoundingClientRect();
            const slogan = document.querySelector('.rally-splash-slogan').getBoundingClientRect();
            const lines = [...document.querySelectorAll('.rally-splash-slogan strong span, .rally-splash-slogan small span')]
                .map((line) => line.getBoundingClientRect());
            const safeInset = room.width * 0.13;
            return {
                roomLeft: room.left,
                roomRight: room.right,
                sloganLeft: slogan.left,
                sloganRight: slogan.right,
                safeLeft: room.left + safeInset,
                safeRight: room.right - safeInset,
                linesFit: lines.every((line) => line.left >= room.left + safeInset && line.right <= room.right - safeInset),
            };
        }"""
    )
    assert geometry["sloganLeft"] >= geometry["safeLeft"] - 0.5, geometry
    assert geometry["sloganRight"] <= geometry["safeRight"] + 0.5, geometry
    assert geometry["linesFit"], geometry


def main():
    OUTPUT_PATH.parent.mkdir(exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(
            viewport={"width": 390, "height": 844},
            device_scale_factor=1,
            is_mobile=True,
            has_touch=True,
        )
        errors = []
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        page.on("pageerror", lambda error: errors.append(str(error)))

        page.goto(f"{BASE_URL}/?variant=A&splash=1", wait_until="domcontentloaded")
        splash = page.locator("#rally-splash")
        assert splash.is_visible()
        assert page.get_by_text("找到合拍的人，", exact=True).is_visible()
        assert page.get_by_text("一起把事做成。", exact=True).is_visible()
        assert page.get_by_text("Meet the right people.", exact=True).is_visible()
        assert page.get_by_text("Build together.", exact=True).is_visible()
        assert splash.get_by_text("合拍", exact=True).is_visible()
        assert splash.get_by_text("共域", exact=True).count() == 0
        assert splash.locator(".rally-splash-person").count() == 2
        assert splash.locator(".rally-room-line").count() == 2
        assert splash.evaluate("element => getComputedStyle(element).position") == "fixed"

        page.wait_for_timeout(1900)
        assert_slogan_stays_inside_room(page)
        page.screenshot(path=str(OUTPUT_PATH), full_page=True)
        splash.wait_for(state="detached", timeout=3500)
        assert page.locator(".recommendation-card-active").is_visible()

        page.set_viewport_size({"width": 1024, "height": 1100})
        page.goto(f"{BASE_URL}/?variant=A&splash=1", wait_until="domcontentloaded")
        page.wait_for_timeout(1900)
        assert_slogan_stays_inside_room(page)
        page.locator("#rally-splash").click()
        assert not errors, errors
        browser.close()

    print("COSPAN splash animation passed")


if __name__ == "__main__":
    main()
