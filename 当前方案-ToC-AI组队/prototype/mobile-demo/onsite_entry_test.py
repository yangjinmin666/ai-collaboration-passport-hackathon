from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:4173"
QR_EVENT_URL = "https://101.43.172.166/?live=1&event=hackathon-2026&source=qr"
NFC_EVENT_URL = "https://101.43.172.166/?live=1&event=hackathon-2026&source=nfc"


def px(value: str) -> float:
    return float(value.removesuffix("px"))


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 390, "height": 844})

    page.goto(f"{BASE_URL}/join.html", wait_until="networkidle")
    page.get_by_role("heading", name="扫码进入现场协作").wait_for()
    qr = page.get_by_alt_text("COSPAN 现场入口二维码")
    assert qr.is_visible()
    assert qr.evaluate("element => element.complete && element.naturalWidth > 0")
    assert page.get_by_role("link", name="在本机打开 COSPAN").get_attribute("href") == (
        "./?live=1&event=hackathon-2026&source=qr"
    )
    assert QR_EVENT_URL in page.locator("code").inner_text()
    assert QR_EVENT_URL != NFC_EVENT_URL
    assert "source=qr" in QR_EVENT_URL and "source=nfc" in NFC_EVENT_URL

    qr_source = page.locator(".qr img").get_attribute("src")
    assert qr_source == "./assets/event-entry-qr.svg"

    page.reload(wait_until="networkidle")
    page.context.set_offline(True)
    page.goto(f"{BASE_URL}/join.html", wait_until="domcontentloaded")
    page.get_by_role("heading", name="扫码进入现场协作").wait_for()
    page.context.set_offline(False)

    page.goto(f"{BASE_URL}/?live=0&variant=A&splash=0", wait_until="networkidle")
    context_trigger = page.locator(".context-switch-trigger")
    context_trigger.wait_for()
    assert "She Nicest 2026" in context_trigger.inner_text()
    context_trigger.click()
    page.locator(".context-switcher-sheet").wait_for()
    page.wait_for_timeout(50)

    radios = page.get_by_role("radio").all()
    assert len(radios) == 2
    assert radios[0].get_attribute("aria-checked") == "true"
    assert radios[1].get_attribute("aria-checked") == "false"

    assert page.locator(".prototype-stage").evaluate(
        "element => element.inert && element.getAttribute('aria-hidden') === 'true'"
    )
    assert px(page.locator(".context-option small").first.evaluate("element => getComputedStyle(element).fontSize")) >= 12
    assert px(page.locator(".context-switcher-note").evaluate("element => getComputedStyle(element).fontSize")) >= 12

    for _ in range(8):
        page.keyboard.press("Tab")
        assert page.evaluate("document.querySelector('.overlay').contains(document.activeElement)")

    semantic_colors = page.evaluate(
        """() => {
          const style = getComputedStyle(document.documentElement);
          return {
            brand: style.getPropertyValue('--brand').trim(),
            success: style.getPropertyValue('--success').trim(),
            warning: style.getPropertyValue('--warning').trim(),
          };
        }"""
    )
    assert semantic_colors["success"] != semantic_colors["brand"]
    assert semantic_colors["warning"] != semantic_colors["brand"]

    browser.close()

print("COSPAN onsite entry and overlay accessibility passed")
