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
            const chinese = document.querySelector('.rally-splash-slogan strong');
            const english = document.querySelector('.rally-splash-slogan small');
            const safeInset = room.width * 0.13;
            return {
                roomLeft: room.left,
                roomRight: room.right,
                sloganLeft: slogan.left,
                sloganRight: slogan.right,
                safeLeft: room.left + safeInset,
                safeRight: room.right - safeInset,
                chineseFits: chinese.scrollWidth <= chinese.clientWidth,
                englishFits: english.scrollWidth <= english.clientWidth,
            };
        }"""
    )
    assert geometry["sloganLeft"] >= geometry["safeLeft"] - 0.5, geometry
    assert geometry["sloganRight"] <= geometry["safeRight"] + 0.5, geometry
    assert geometry["chineseFits"], geometry
    assert geometry["englishFits"], geometry


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
        assert page.get_by_text("人与人先相遇，人与 Agent 再共创。", exact=True).is_visible()
        assert page.get_by_text("Meet as people. Build with agents.", exact=True).is_visible()
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
