"""Check a production build without dependencies or network access."""

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, unquote, urljoin, urlsplit
import re
import unittest
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1] / "public"
ORIGIN = "https://rockorager.dev"
POST = "/blog/lsr-ls-but-with-io-uring/"
PUBLISHED = {"blog": set(), "misc": set()}
DRAFTS = []
for section in PUBLISHED:
    for source in (ROOT.parent / "content" / section).rglob("*.md"):
        if source.name == "_index.md":
            continue
        text = source.read_text()
        metadata = text.split(text.splitlines()[0], 2)[1]
        slug = source.parent.name if source.name == "index.md" else source.stem
        if re.search(r"^draft\s*[:=]\s*true\s*$", metadata, re.MULTILINE | re.IGNORECASE):
            DRAFTS.append((section, slug))
        else:
            PUBLISHED[section].add(f"{ORIGIN}/{section}/{slug}/")


class HTML(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.elements = []
        self.feed(path.read_text())

    def handle_starttag(self, tag, attrs):
        self.elements.append((tag, dict(attrs)))


class SiteTests(unittest.TestCase):
    def test_published_routes_and_redirects(self):
        for route in ("/", "/blog/", POST, "/misc/"):
            self.assertTrue((ROOT / route.lstrip("/") / "index.html").exists(), route)
        for old, new in (("/posts/", "/blog/"), (POST.replace("/blog/", "/posts/"), POST)):
            html = (ROOT / old.lstrip("/") / "index.html").read_text()
            self.assertIn(ORIGIN + new, html)
            self.assertIn("window.location.replace(target + hash)", html)
        self.assertEqual(
            (ROOT / "posts/lsr-ls-but-with-io-uring/screenshot.webp").read_bytes(),
            (ROOT / "blog/lsr-ls-but-with-io-uring/screenshot.webp").read_bytes(),
        )
        images = [a["src"] for tag, a in HTML(ROOT / POST.lstrip("/") / "index.html").elements if tag == "img"]
        self.assertEqual(images, [POST + "screenshot.webp"])

    def test_drafts_are_not_published(self):
        for section, slug in DRAFTS:
            for prefix in (section, "posts"):
                self.assertFalse((ROOT / prefix / slug).exists(), slug)
            for listing in ("index.html", "blog/index.html", "index.xml", "blog/index.xml", "sitemap.xml"):
                self.assertNotIn(slug, (ROOT / listing).read_text())

    def test_feeds_and_legacy_subscriptions(self):
        all_pages = PUBLISHED["blog"] | PUBLISHED["misc"]
        for feed, expected in (("blog/index.xml", PUBLISHED["blog"]), ("posts/index.xml", PUBLISHED["blog"]), ("index.xml", all_pages), ("misc/index.xml", PUBLISHED["misc"])):
            items = ET.parse(ROOT / feed).findall("./channel/item")
            self.assertEqual({item.findtext("link") for item in items}, expected, feed)
            self.assertEqual(len(items), len(expected), feed)
        items = ET.parse(ROOT / "blog/index.xml").findall("./channel/item")
        item = next(item for item in items if item.findtext("link") == ORIGIN + POST)
        self.assertEqual(item.findtext("title"), "lsr: ls but with io_uring")
        self.assertEqual((ROOT / "posts/index.xml").read_bytes(), (ROOT / "blog/index.xml").read_bytes())

    def test_local_links_assets_and_heading_anchors(self):
        for path in ROOT.rglob("*.html"):
            source = ORIGIN + "/" + str(path.relative_to(ROOT)).removesuffix("index.html")
            for tag, attrs in HTML(path).elements:
                for key in ("href", "src"):
                    value = attrs.get(key)
                    if not value:
                        continue
                    url = urlsplit(urljoin(source, value))
                    if url.netloc != "rockorager.dev" or url.scheme not in ("https", "http"):
                        continue
                    target = ROOT / unquote(url.path).lstrip("/")
                    if target.is_dir():
                        target /= "index.html"
                    self.assertTrue(target.is_file(), f"{path}: {value}")
                    if url.fragment and target.suffix == ".html":
                        ids = {a.get("id") for _, a in HTML(target).elements}
                        self.assertIn(unquote(url.fragment), ids, f"{path}: {value}")
        ids = {a.get("id") for _, a in HTML(ROOT / "misc/osc-9-4-progress-bars/index.html").elements}
        self.assertIn("xtermjs", ids)

    def test_reply_subject_and_navigation(self):
        html = HTML(ROOT / POST.lstrip("/") / "index.html")
        replies = [a["href"] for tag, a in html.elements if tag == "a" and a.get("href", "").startswith("mailto:") and "?subject=" in a["href"]]
        self.assertEqual(len(replies), 1)
        self.assertEqual(urlsplit(replies[0]).path, "tim@timculverhouse.com")
        self.assertEqual(parse_qs(urlsplit(replies[0]).query)["subject"], ["lsr: ls but with io_uring"])
        active = [a["href"] for tag, a in html.elements if tag == "a" and "aria-current" in a]
        self.assertEqual(active, ["/blog/"])


if __name__ == "__main__":
    unittest.main()
