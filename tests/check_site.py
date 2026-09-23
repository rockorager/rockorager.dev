"""Check the running local EmDash site; optionally compare a saved Zola build."""

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, unquote, urljoin, urlsplit
from urllib.request import urlopen, build_opener, HTTPRedirectHandler, Request
from urllib.error import HTTPError
import os
import re
import unittest
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
SERVER = os.environ.get("SITE_URL", "http://localhost:4322").rstrip("/")
ORIGIN = "https://rockorager.dev"
# Cloudflare's browser integrity check rejects Python's default user-agent.
HEADERS = {"User-Agent": "rockorager-site-check/1.0"}
POST = "/blog/lsr-ls-but-with-io-uring/"
PUBLISHED = {"blog": set(), "misc": set()}
DRAFTS = []
for section in PUBLISHED:
    for source in (ROOT / "content" / section).rglob("*.md"):
        if source.name == "_index.md":
            continue
        text = source.read_text()
        metadata = text.split(text.splitlines()[0], 2)[1]
        slug = source.parent.name if source.name == "index.md" else source.stem
        if re.search(r"^draft\s*[:=]\s*true\s*$", metadata, re.MULTILINE | re.IGNORECASE):
            DRAFTS.append((section, slug))
        else:
            PUBLISHED[section].add(f"{ORIGIN}/{section}/{slug}/")


def fetch(path):
    with urlopen(Request(SERVER + path, headers=HEADERS)) as response:
        return response.read()


class HTML(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.elements = []
        self.article_text = []
        self.reply_text = []
        self.code = []
        self.in_article = False
        self.in_reply = False
        self.in_pre = False
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        self.elements.append((tag, dict(attrs)))
        if tag == "article":
            self.in_article = True
        if tag == "p" and "post-reply" in dict(attrs).get("class", "").split():
            self.in_reply = True
        if tag == "pre":
            self.in_pre = True
            self.code.append("")

    def handle_endtag(self, tag):
        if tag == "article":
            self.in_article = False
        if tag == "p":
            self.in_reply = False
        if tag == "pre":
            self.in_pre = False

    def handle_data(self, text):
        if self.in_reply:
            self.reply_text.append(text)
        elif self.in_article and text.strip() != "#":
            self.article_text.append(text)
        if self.in_pre:
            self.code[-1] += text


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None


class SiteTests(unittest.TestCase):
    def test_published_routes_and_redirects(self):
        for route in ("/", "/blog/", POST, "/misc/"):
            self.assertIn(b"<main>", fetch(route))
        for old, new in (("/posts/", "/blog/"), (POST.replace("/blog/", "/posts/"), POST), ("/blog", "/blog/")):
            with self.assertRaises(HTTPError) as caught:
                build_opener(NoRedirect).open(Request(SERVER + old + "?ref=old", headers=HEADERS))
            self.assertEqual(caught.exception.code, 301)
            self.assertEqual(caught.exception.headers["Location"], new + "?ref=old")
        self.assertEqual(fetch("/posts/lsr-ls-but-with-io-uring/screenshot.webp"), fetch(POST + "screenshot.webp"))
        images = [a["src"] for tag, a in HTML(fetch(POST).decode()).elements if tag == "img"]
        self.assertEqual(images, [POST + "screenshot.webp"])

    def test_drafts_are_not_published(self):
        listings = [fetch(path).decode() for path in ("/", "/blog/", "/index.xml", "/blog/index.xml", "/sitemap.xml")]
        for section, slug in DRAFTS:
            with self.assertRaises(HTTPError) as caught:
                fetch(f"/{section}/{slug}/")
            self.assertEqual(caught.exception.code, 404, slug)
            for listing in listings:
                self.assertNotIn(slug, listing)

    def test_feeds_and_legacy_subscriptions(self):
        all_pages = PUBLISHED["blog"] | PUBLISHED["misc"]
        for feed, expected in (("blog/index.xml", PUBLISHED["blog"]), ("posts/index.xml", PUBLISHED["blog"]), ("index.xml", all_pages), ("misc/index.xml", PUBLISHED["misc"])):
            items = ET.fromstring(fetch("/" + feed)).findall("./channel/item")
            self.assertEqual({item.findtext("link") for item in items}, expected, feed)
            self.assertEqual(len(items), len(expected), feed)
            for item in items:
                body = item.findtext("{http://purl.org/rss/1.0/modules/content/}encoded")
                self.assertTrue(body, "Full article body must be included")
                for tag, attrs in HTML(body).elements:
                    for key in ("src", "href"):
                        if key in attrs:
                            self.assertFalse(attrs[key].startswith(("/", "#")), attrs[key])
        self.assertEqual(fetch("/posts/index.xml"), fetch("/blog/index.xml"))

    def test_local_links_assets_and_heading_anchors(self):
        for source in PUBLISHED["blog"] | PUBLISHED["misc"] | {ORIGIN + "/", ORIGIN + "/blog/", ORIGIN + "/misc/"}:
            for tag, attrs in HTML(fetch(urlsplit(source).path).decode()).elements:
                for key in ("href", "src"):
                    value = attrs.get(key)
                    if not value:
                        continue
                    url = urlsplit(urljoin(source, value))
                    if url.netloc != "rockorager.dev" or url.scheme not in ("https", "http"):
                        continue
                    data = fetch(url.path)
                    if url.fragment:
                        ids = {a.get("id") for _, a in HTML(data.decode()).elements}
                        self.assertIn(unquote(url.fragment), ids, f"{source}: {value}")
        ids = {a.get("id") for _, a in HTML(fetch("/misc/osc-9-4-progress-bars/").decode()).elements}
        self.assertIn("xtermjs", ids)

    def test_reply_subject_and_navigation(self):
        html = HTML(fetch(POST).decode())
        self.assertEqual("".join(html.reply_text), "Send me your thoughts")
        replies = [a["href"] for tag, a in html.elements if tag == "a" and a.get("href", "").startswith("mailto:") and "?subject=" in a["href"]]
        self.assertEqual(len(replies), 1)
        self.assertEqual(urlsplit(replies[0]).path, "tim@timculverhouse.com")
        self.assertEqual(parse_qs(urlsplit(replies[0]).query)["subject"], ["lsr: ls but with io_uring"])
        self.assertEqual([a["href"] for tag, a in html.elements if tag == "a" and "aria-current" in a], ["/blog/"])
        for path in ("/", POST, "/misc/osc-9-4-progress-bars/"):
            source = fetch(path).decode()
            page = HTML(source)
            self.assertNotIn("footer", [tag for tag, _ in page.elements])
            header = HTML(source.split("<header>", 1)[1].split("</header>", 1)[0])
            self.assertEqual({a["aria-label"]: a["href"] for tag, a in header.elements if tag == "a" and "aria-label" in a}, {
                "RSS feed": "/blog/index.xml", "GitHub": "https://github.com/rockorager",
                "Twitter/X": "https://x.com/rockorager", "Email": "mailto:tim@timculverhouse.com",
            })
            if path != POST:
                self.assertEqual(page.reply_text, [])

    @unittest.skipUnless(os.environ.get("ZOLA_BASELINE"), "Set ZOLA_BASELINE to compare the pre-migration build")
    def test_original_content(self):
        for url in PUBLISHED["blog"] | PUBLISHED["misc"]:
            path = urlsplit(url).path
            before = HTML((Path(os.environ["ZOLA_BASELINE"]) / path.lstrip("/") / "index.html").read_text())
            after = HTML(fetch(path).decode())
            normalize = lambda parts: re.sub(r"\s+", "", "".join(parts))
            self.assertEqual(normalize(before.article_text), normalize(after.article_text), path)
            self.assertEqual([code.rstrip() for code in before.code], [code.rstrip() for code in after.code], path)
            self.assertEqual({a["id"] for _, a in before.elements if "id" in a}, {a["id"] for _, a in after.elements if "id" in a}, path)


if __name__ == "__main__":
    unittest.main()
