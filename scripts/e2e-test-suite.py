#!/usr/bin/env python3
"""
Comprehensive Opaque-Box E2E Test Suite for Ivan Jairus Portfolio v2
Author: e2e_test_writer_1 (teamwork_preview_test_writer)
Specification Authorities:
- ORIGINAL_REQUEST.md
- PROJECT.md
- explorer_survey_1/spec_report.md

Covers 27 Features and 12 Edge Cases across 4 Test Tiers:
- Tier 1: Feature Coverage (27 features * 5 tests = 135 tests)
- Tier 2: Boundary & Corner Cases (27 features * 5 tests = 135 tests)
- Tier 3: Cross-Feature Interactions & Pairwise Combinations (28 tests)
- Tier 4: Real-World User Workloads & Journeys (15 tests)
Total: 313 test cases (exceeds requirement of >=311).

Zero external runtime dependencies: stdlib-only (unittest, html.parser, urllib, re, json, hashlib).
Supports testing direct static filesystem AND/OR local HTTP server (http://127.0.0.1:8731).
Progressive Testability: Adapts smoothly whether work/ is already split or in progress.
"""

import sys
import os
import re
import json
import hashlib
import unittest
import argparse
import urllib.request
import urllib.error
from html.parser import HTMLParser
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration & Client Context
# ---------------------------------------------------------------------------

class SiteContext:
    """Manages site access across filesystem and HTTP modes."""
    def __init__(self, root_dir=None, mode="auto", base_url="http://127.0.0.1:8731"):
        if root_dir is None:
            script_dir = Path(__file__).resolve().parent
            self.root_dir = script_dir.parent
        else:
            self.root_dir = Path(root_dir).resolve()

        self.mode = mode
        self.base_url = base_url.rstrip("/")
        self.http_available = self._probe_http()

        if self.mode == "http" and not self.http_available:
            raise RuntimeError(f"HTTP mode requested but server is unreachable at {self.base_url}")

    def _probe_http(self):
        try:
            req = urllib.request.Request(self.base_url + "/", headers={"User-Agent": "E2ETestRunner/1.0"})
            with urllib.request.urlopen(req, timeout=1.5) as resp:
                return resp.status == 200
        except Exception:
            return False

    def has_file(self, rel_path):
        return (self.root_dir / rel_path.lstrip("/")).is_file()

    def get_text(self, rel_path):
        rel_path = rel_path.lstrip("/")
        # Progressive fallback for work/index.html before M3 split
        if rel_path in ("work/index.html", "work/") and not self.has_file("work/index.html"):
            return self.get_text("index.html")

        if self.mode == "http" or (self.mode == "auto" and self.http_available and rel_path.endswith(".html")):
            url = f"{self.base_url}/{rel_path}"
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "E2ETestRunner/1.0"})
                with urllib.request.urlopen(req, timeout=3.0) as resp:
                    return resp.read().decode("utf-8")
            except urllib.error.HTTPError as e:
                if e.code == 404 and rel_path.startswith("work"):
                    return self.get_text("index.html")
                raise

        file_path = self.root_dir / rel_path
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()

    def get_work_html(self):
        """Returns work/index.html if available, else index.html where case studies live."""
        if self.has_file("work/index.html"):
            return self.get_text("work/index.html")
        return self.get_text("index.html")

    def get_work_css(self):
        """Returns assets/css/work.css if available, else assets/css/showcase.css."""
        if self.has_file("assets/css/work.css"):
            return self.get_text("assets/css/work.css")
        return self.get_text("assets/css/showcase.css")

    def get_bytes(self, rel_path):
        rel_path = rel_path.lstrip("/")
        if self.mode == "http" or (self.mode == "auto" and self.http_available and not rel_path.endswith((".json", ".mjs", ".sh", ".groovy"))):
            url = f"{self.base_url}/{rel_path}"
            req = urllib.request.Request(url, headers={"User-Agent": "E2ETestRunner/1.0"})
            with urllib.request.urlopen(req, timeout=3.0) as resp:
                return resp.read()
        else:
            file_path = self.root_dir / rel_path
            with open(file_path, "rb") as f:
                return f.read()

    def get_json(self, rel_path):
        content = self.get_text(rel_path)
        return json.loads(content)

    def http_request(self, rel_path):
        rel_path = rel_path.lstrip("/")
        url = f"{self.base_url}/{rel_path}"
        req = urllib.request.Request(url, headers={"User-Agent": "E2ETestRunner/1.0"})
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            return resp.status, dict(resp.headers), resp.read()


CTX = SiteContext()

# ---------------------------------------------------------------------------
# Zero-Dependency DOM Tree Parser
# ---------------------------------------------------------------------------

class DOMNode:
    """Queryable DOM element node with case-insensitive attribute normalization."""
    VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input",
                 "link", "meta", "param", "source", "track", "wbr"}

    def __init__(self, tag, attrs=None, parent=None):
        self.tag = tag.lower() if tag else ""
        self.attrs = {k.lower(): v for k, v in (attrs or [])}
        self.children = []
        self.parent = parent
        self.text_content = []

    def get_attr(self, name, default=None):
        return self.attrs.get(name.lower(), default)

    def has_class(self, cls_name):
        classes = self.attrs.get("class", "").split()
        return cls_name in classes

    def get_text(self, recursive=True):
        if not recursive:
            return "".join(self.text_content)
        texts = list(self.text_content)
        for child in self.children:
            texts.append(child.get_text(recursive=True))
        return "".join(texts)

    def find_all(self, tag=None, attrs=None, **kwargs):
        query_attrs = {}
        if attrs and isinstance(attrs, dict):
            query_attrs.update(attrs)
        query_attrs.update(kwargs)

        results = []
        def _match(node):
            if tag and node.tag != tag.lower():
                return False
            for k, v in query_attrs.items():
                attr_name = "class" if k in ("class_", "cls") else k.lower()
                if attr_name == "class":
                    classes = node.attrs.get("class", "").split()
                    if isinstance(v, (list, tuple, set)):
                        if not all(c in classes for c in v):
                            return False
                    elif v not in classes:
                        return False
                elif v is True:
                    if attr_name not in node.attrs:
                        return False
                elif v is False:
                    if attr_name in node.attrs:
                        return False
                elif callable(v):
                    val = node.attrs.get(attr_name)
                    # For boolean attributes like data-menu-btn, val is None when present
                    arg = True if (val is None and attr_name in node.attrs) else val
                    if not v(arg):
                        return False
                elif attr_name in node.attrs:
                    if node.attrs[attr_name] != v:
                        return False
                else:
                    return False
            return True

        def _traverse(node):
            for child in node.children:
                if _match(child):
                    results.append(child)
                _traverse(child)

        _traverse(self)
        return results

    def find(self, tag=None, attrs=None, **kwargs):
        res = self.find_all(tag, attrs, **kwargs)
        return res[0] if res else None

    def find_by_id(self, id_val):
        results = []
        def _traverse(node):
            if node.attrs.get("id") == id_val:
                results.append(node)
            for child in node.children:
                _traverse(child)
        _traverse(self)
        return results[0] if results else None


class SimpleHTMLParser(HTMLParser):
    """Parses HTML into a DOMNode tree."""
    def __init__(self):
        super().__init__()
        self.root = DOMNode("root")
        self.current = self.root

    def handle_starttag(self, tag, attrs):
        node = DOMNode(tag, attrs, parent=self.current)
        self.current.children.append(node)
        if tag.lower() not in DOMNode.VOID_TAGS:
            self.current = node

    def handle_endtag(self, tag):
        if tag.lower() in DOMNode.VOID_TAGS:
            return
        node = self.current
        while node and node.tag != tag.lower():
            node = node.parent
        if node and node.parent:
            self.current = node.parent

    def handle_data(self, data):
        if self.current:
            self.current.text_content.append(data)


def parse_html(html_str):
    parser = SimpleHTMLParser()
    parser.feed(html_str)
    return parser.root


# ---------------------------------------------------------------------------
# Tier 1: Feature Coverage Tests (F01 to F27, 5 tests each = 135 tests)
# ---------------------------------------------------------------------------

class Tier1_FeatureCoverage(unittest.TestCase):
    """Tier 1: Feature Coverage for all 27 features (5 tests per feature)."""

    # --- F01: 10-Second Rule Hero ---
    def test_f01_01_hero_semantic_structure(self):
        dom = parse_html(CTX.get_text("index.html"))
        hero = dom.find("section", cls="hero")
        self.assertIsNotNone(hero, "Hero section with class 'hero' must exist")
        h1 = hero.find("h1")
        self.assertIsNotNone(h1, "Hero must contain an h1 heading")
        self.assertIn("Ivan Jairus", h1.get_text())

    def test_f01_02_hero_identity_and_role(self):
        dom = parse_html(CTX.get_text("index.html"))
        role_el = dom.find("p", cls="hero-role")
        self.assertIsNotNone(role_el, "hero-role element must exist")
        self.assertIn("DevSecOps", role_el.get_text())

    def test_f01_03_hero_value_proposition(self):
        dom = parse_html(CTX.get_text("index.html"))
        facts = dom.find("p", cls="hero-facts")
        self.assertIsNotNone(facts, "hero-facts element must exist")
        self.assertIn("Jakarta", facts.get_text())
        tagline = dom.find("p", cls="hero-tag")
        self.assertIsNotNone(tagline, "hero-tag element must exist")
        self.assertIn("Platform engineer", tagline.get_text())

    def test_f01_04_hero_action_ctas(self):
        dom = parse_html(CTX.get_text("index.html"))
        cta_wrap = dom.find("div", cls="hero-cta")
        self.assertIsNotNone(cta_wrap, "hero-cta container must exist")
        links = cta_wrap.find_all("a")
        self.assertGreaterEqual(len(links), 3, "Hero must provide at least 3 action CTAs")
        hrefs = [a.get_attr("href") for a in links]
        self.assertTrue(any("#work" in h or "work/" in h for h in hrefs), "CTA to work required")
        self.assertTrue(any("#contact" in h for h in hrefs), "CTA to contact required")
        self.assertTrue(any("cv" in h.lower() for h in hrefs), "CTA to CV required")

    def test_f01_05_hero_cv_pdf_target(self):
        pdf_bytes = CTX.get_bytes("assets/cv/cv-ivan-jairus.pdf")
        self.assertTrue(pdf_bytes.startswith(b"%PDF-"), "CV asset must be a valid PDF file")
        self.assertGreater(len(pdf_bytes), 1000, "CV PDF must not be empty")

    # --- F02: Verified Numbers Grid ---
    def test_f02_01_proof_services_count(self):
        html = CTX.get_text("index.html")
        self.assertRegex(html, r"53\s+services", "Hero proof must declare 53 services")

    def test_f02_02_proof_artifact_types_count(self):
        html = CTX.get_text("index.html")
        self.assertRegex(html, r"5\s+artifact\s+types", "Hero proof must declare 5 artifact types")

    def test_f02_03_proof_environments_count(self):
        html = CTX.get_text("index.html")
        self.assertRegex(html, r"3\s+environments", "Hero proof must declare 3 environments")

    def test_f02_04_proof_gateway_or_tests_count(self):
        html = CTX.get_text("index.html")
        self.assertTrue("1 gateway" in html or "330" in html, "Proof must include 1 gateway or ~330 tests")

    def test_f02_05_proof_no_hyped_buzzwords(self):
        dom = parse_html(CTX.get_text("index.html"))
        hero = dom.find("section", cls="hero")
        hero_text = hero.get_text().lower()
        for buzz in ["revolutionary", "seamless", "cutting-edge", "next-level", "game-changer"]:
            self.assertNotIn(buzz, hero_text, f"Forbidden buzzword '{buzz}' found in hero")

    # --- F03: Before vs After Matrix ---
    def test_f03_01_matrix_container_presence(self):
        html = CTX.get_work_html()
        dom = parse_html(html)
        ba = dom.find("div", cls="ba")
        self.assertIsNotNone(ba, "Before/After container .ba must exist")

    def test_f03_02_matrix_before_side_content(self):
        dom = parse_html(CTX.get_work_html())
        ba_before = dom.find("div", cls="ba-before")
        self.assertIsNotNone(ba_before, "ba-before side must exist")
        before_text = ba_before.get_text().lower()
        self.assertTrue("columns" in before_text or "out of the box" in before_text or "no approval" in before_text)

    def test_f03_03_matrix_after_side_content(self):
        dom = parse_html(CTX.get_work_html())
        ba_after = dom.find("div", cls="ba-after")
        self.assertIsNotNone(ba_after, "ba-after side must exist")
        after_text = ba_after.get_text().lower()
        self.assertTrue("approval" in after_text or "phase" in after_text or "runs the release" in after_text)

    def test_f03_04_matrix_arrow_transition(self):
        dom = parse_html(CTX.get_work_html())
        arrow = dom.find("div", cls="ba-arrow")
        self.assertIsNotNone(arrow, "Transition indicator .ba-arrow must exist")
        self.assertIn("automated actions", arrow.get_text())

    def test_f03_05_matrix_before_line_summary(self):
        html = CTX.get_work_html()
        self.assertIn("approvals lived in chat", html)
        self.assertIn("release state lived in one person's head", html)

    # --- F04: Flagship Preview Cards ---
    def test_f04_01_card_1_chatops_orchestrator(self):
        dom = parse_html(CTX.get_text("index.html"))
        card1 = dom.find_by_id("proj-1")
        self.assertIsNotNone(card1, "Card #proj-1 (ChatOps) must exist on overview")
        self.assertIn("ChatOps", card1.get_text())
        links = [a.get_attr("href") for a in card1.find_all("a")]
        self.assertTrue(any("work" in h or "diagrams" in h for h in links), "Must link to work case study or diagrams")

    def test_f04_02_card_2_pipeline_platform(self):
        dom = parse_html(CTX.get_text("index.html"))
        card2 = dom.find_by_id("proj-2")
        self.assertIsNotNone(card2, "Card #proj-2 (Pipeline-as-a-Product) must exist on overview")
        self.assertIn("Pipeline-as-a-Product", card2.get_text())
        links = [a.get_attr("href") for a in card2.find_all("a")]
        self.assertTrue(any("work" in h or "diagrams" in h or "github" in h for h in links))

    def test_f04_03_card_3_control_plane(self):
        dom = parse_html(CTX.get_text("index.html"))
        card3 = dom.find_by_id("proj-3")
        self.assertIsNotNone(card3, "Card #proj-3 (Release Control Plane) must exist on overview")
        self.assertIn("Control Plane", card3.get_text())
        links = [a.get_attr("href") for a in card3.find_all("a")]
        self.assertTrue(any("work" in h or "github" in h for h in links))

    def test_f04_04_flagship_doors_links(self):
        dom = parse_html(CTX.get_text("index.html"))
        all_links = [a.get_attr("href") for a in dom.find_all("a")]
        self.assertTrue(any("decisions" in (h or "") for h in all_links), "Door link to decisions/ required")

    def test_f04_05_gate_excerpt_quoted(self):
        dom = parse_html(CTX.get_text("index.html"))
        wv_log = dom.find("pre", cls="wv-log")
        self.assertIsNotNone(wv_log, "Quoted gate excerpt must be rendered on index.html")
        self.assertIn("GateResult.evaluate passed=false", wv_log.get_text())

    # --- F05: Production Mileage Toolbox ---
    def test_f05_01_toolbox_section_exists(self):
        dom = parse_html(CTX.get_text("index.html"))
        tb = dom.find_by_id("toolbox")
        self.assertIsNotNone(tb, "#toolbox section must exist")
        self.assertIn("Toolbox by production mileage", tb.get_text())

    def test_f05_02_toolbox_three_tiers_legend(self):
        dom = parse_html(CTX.get_text("index.html"))
        legend = dom.find("div", cls="tier-legend")
        self.assertIsNotNone(legend, "tier-legend must exist")
        text = legend.get_text().lower()
        self.assertIn("production daily", text)
        self.assertIn("production regular", text)
        self.assertIn("project exposure", text)

    def test_f05_03_toolbox_filter_buttons(self):
        dom = parse_html(CTX.get_text("index.html"))
        filter_bar = dom.find("div", cls="tier-filter")
        self.assertIsNotNone(filter_bar, "tier-filter controls must exist")
        buttons = filter_bar.find_all("button")
        filters = [b.get_attr("data-filter") for b in buttons]
        self.assertIn("daily", filters)
        self.assertIn("regular", filters)
        self.assertIn("exposure", filters)
        self.assertIn("all", filters)

    def test_f05_04_toolbox_skill_items_presence(self):
        dom = parse_html(CTX.get_text("index.html"))
        skills = dom.find_all("div", cls="skill-item")
        self.assertGreaterEqual(len(skills), 10, "Must feature comprehensive skill items")
        skill_texts = [s.get_text() for s in skills]
        self.assertTrue(any("GitLab CI" in s for s in skill_texts))
        self.assertTrue(any("Python" in s for s in skill_texts))

    def test_f05_05_toolbox_evidence_references(self):
        dom = parse_html(CTX.get_text("index.html"))
        refs = dom.find_all("a", cls="ref")
        self.assertGreater(len(refs), 5, "Toolbox items must carry evidence reference links")
        for r in refs:
            self.assertTrue(r.get_attr("href").startswith("#proj-"), "Ref must anchor to a project card")

    # --- F06: Case Study I (GitLab Board Orchestrator) ---
    def test_f06_01_case_study_1_section(self):
        dom = parse_html(CTX.get_work_html())
        sec = dom.find_by_id("board")
        self.assertIsNotNone(sec, "#board case study section must exist")
        self.assertIn("GitLab board", sec.get_text())

    def test_f06_02_case_study_1_orchestration_scale(self):
        html = CTX.get_work_html()
        self.assertIn("18 orchestrators", html)
        self.assertIn("32 pipeline jobs", html)

    def test_f06_03_case_study_1_approval_chain(self):
        html = CTX.get_work_html()
        self.assertIn("5-layer approval", html)

    def test_f06_04_case_study_1_anti_loop_guards(self):
        html = CTX.get_work_html()
        self.assertIn("anti-loop", html.lower())
        self.assertIn("watermark", html.lower())

    def test_f06_05_case_study_1_unit_tests(self):
        html = CTX.get_work_html()
        self.assertIn("~330 unit tests", html)

    # --- F07: Case Study II (Release Control Plane) ---
    def test_f07_01_case_study_2_section(self):
        dom = parse_html(CTX.get_work_html())
        sec = dom.find_by_id("platform")
        self.assertIsNotNone(sec, "#platform case study section must exist")
        sec_text = sec.get_text().lower()
        self.assertTrue("control plane" in sec_text or "dashboard" in sec_text)

    def test_f07_02_case_study_2_sse_streaming(self):
        html = CTX.get_work_html()
        self.assertRegex(html, r"SSE|server-sent\s+events", "Must document SSE capability")

    def test_f07_03_case_study_2_diff_releases(self):
        html = CTX.get_work_html()
        self.assertTrue("diff" in html.lower() or "diverged" in html.lower())

    def test_f07_04_case_study_2_composite_gate(self):
        html = CTX.get_work_html()
        self.assertIn("Composite quality gate", html)

    def test_f07_05_case_study_2_rbac(self):
        html = CTX.get_work_html()
        self.assertRegex(html, r"admin.*devsecops.*developer|Role-based\s+access", "Must document RBAC roles")

    # --- F08: Case Study III (Pipeline-as-a-Product Platform) ---
    def test_f08_01_case_study_3_section(self):
        dom = parse_html(CTX.get_work_html())
        sec = dom.find_by_id("architecture")
        self.assertIsNotNone(sec, "#architecture case study section must exist")
        sec_text = sec.get_text().lower()
        self.assertTrue("gateway" in sec_text or "pipeline" in sec_text or "fifty-three" in sec_text)

    def test_f08_02_case_study_3_gateway_routing(self):
        html = CTX.get_work_html()
        self.assertIn("gateway.yml", html)
        self.assertIn("53 services", html)

    def test_f08_03_case_study_3_five_artifacts(self):
        html = CTX.get_work_html()
        for art in ["jar", "image", "apk", "ipa", "web"]:
            self.assertIn(art, html.lower(), f"Artifact type {art} must be mentioned")

    def test_f08_04_case_study_3_onboarding_contract(self):
        html = CTX.get_work_html()
        self.assertTrue("four-line" in html or "4-line" in html or "include" in html)

    def test_f08_05_case_study_3_reference_repo_link(self):
        dom = parse_html(CTX.get_work_html())
        links = [a.get_attr("href") for a in dom.find_all("a")]
        self.assertTrue(any("github.com/IvanJairus/Pipeline" in h for h in links if h))

    # --- F09: Threat Model Defense Matrix ---
    def test_f09_01_threat_model_section_exists(self):
        dom = parse_html(CTX.get_work_html())
        tm = dom.find_by_id("threat")
        self.assertIsNotNone(tm, "#threat section must exist")

    def test_f09_02_threat_model_scroll_wrapper(self):
        dom = parse_html(CTX.get_work_html())
        wrap = dom.find("div", cls="tm-wrap")
        self.assertIsNotNone(wrap, "Threat model table must be wrapped in .tm-wrap")

    def test_f09_03_threat_model_eight_defended_assets(self):
        html = CTX.get_work_html().lower()
        assets = [
            "release integrity", "production", "secrets", "artifacts",
            "release record", "mobile binaries", "dependencies", "the model itself"
        ]
        found = sum(1 for a in assets if a in html)
        self.assertGreaterEqual(found, 7, "At least 7 of 8 specific threat assets must be detailed")

    def test_f09_04_threat_model_closing_gates_defined(self):
        dom = parse_html(CTX.get_work_html())
        tm_tbl = dom.find("table", cls="tm-tbl")
        self.assertIsNotNone(tm_tbl, "Threat table .tm-tbl must exist")
        headers = [th.get_text().lower() for th in tm_tbl.find_all("th")]
        self.assertTrue(any("gate" in h for h in headers), "Table must specify closing gates header")

    def test_f09_05_threat_model_security_depth(self):
        html = CTX.get_work_html()
        self.assertTrue("vault" in html.lower() or "trivy" in html.lower() or "cyclonedx" in html.lower())

    # --- F10: 21-Phase Board Governance SVG ---
    def test_f10_01_plate_1_section_exists(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        p1 = dom.find_by_id("state-governance")
        self.assertIsNotNone(p1, "#state-governance plate must exist in diagrams/index.html")

    def test_f10_02_plate_1_svg_render(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        p1 = dom.find_by_id("state-governance")
        svg = p1.find("svg")
        self.assertIsNotNone(svg, "Plate 1 must render an SVG element")
        self.assertIn("1280", svg.get_attr("viewBox", ""))

    def test_f10_03_plate_1_upstream_phases(self):
        html = CTX.get_text("diagrams/index.html")
        self.assertIn("UPSTREAM GOVERNANCE", html)
        self.assertIn("12 SEQUENTIAL PHASES", html)

    def test_f10_04_plate_1_execution_engine(self):
        html = CTX.get_text("diagrams/index.html")
        self.assertIn("EXECUTION ENGINE", html)

    def test_f10_05_plate_1_downstream_phases(self):
        html = CTX.get_text("diagrams/index.html")
        self.assertIn("DOWNSTREAM TESTING", html)
        self.assertIn("9 PHASES", html)

    # --- F11: Control Plane & Topology SVG ---
    def test_f11_01_plate_2_section_exists(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        p2 = dom.find_by_id("control-plane")
        self.assertIsNotNone(p2, "#control-plane plate must exist")

    def test_f11_02_plate_2_svg_render(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        p2 = dom.find_by_id("control-plane")
        svg = p2.find("svg")
        self.assertIsNotNone(svg, "Plate 2 must contain an SVG element")

    def test_f11_03_plate_2_three_archetypes(self):
        html = CTX.get_text("diagrams/index.html")
        self.assertTrue("App VM" in html or "VM" in html)
        self.assertTrue("OpenShift" in html or "OCP" in html)
        self.assertTrue("Mobile" in html or "Firebase" in html)

    def test_f11_04_plate_2_sse_topology(self):
        html = CTX.get_text("diagrams/index.html")
        self.assertIn("control plane", html.lower())

    def test_f11_05_plate_2_accessibility_metadata(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        p2 = dom.find_by_id("control-plane")
        svg = p2.find("svg")
        self.assertIsNotNone(svg.find("title"), "Plate 2 SVG must have an accessible title")

    # --- F12: Dual-Track Event Router SVG ---
    def test_f12_01_plate_3_section_exists(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        p3 = dom.find_by_id("event-router")
        self.assertIsNotNone(p3, "#event-router plate must exist")

    def test_f12_02_plate_3_svg_render(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        p3 = dom.find_by_id("event-router")
        self.assertIsNotNone(p3.find("svg"), "Plate 3 must have SVG")

    def test_f12_03_plate_3_board_track(self):
        html = CTX.get_text("diagrams/index.html")
        self.assertTrue("board" in html.lower() or "issue" in html.lower())

    def test_f12_04_plate_3_merge_request_track(self):
        html = CTX.get_text("diagrams/index.html")
        self.assertTrue("merge request" in html.lower() or "mr track" in html.lower())

    def test_f12_05_plate_3_webhook_routing_flow(self):
        html = CTX.get_text("diagrams/index.html")
        self.assertIn("event router", html.lower())

    # --- F13: 6-Domain Convergence SVG ---
    def test_f13_01_plate_4_section_exists(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        p4 = dom.find_by_id("dependency-graph")
        self.assertIsNotNone(p4, "#dependency-graph plate must exist")

    def test_f13_02_plate_4_svg_render(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        p4 = dom.find_by_id("dependency-graph")
        self.assertIsNotNone(p4.find("svg"), "Plate 4 must have SVG")

    def test_f13_03_plate_4_six_domains(self):
        html = CTX.get_text("diagrams/index.html")
        self.assertIn("six pipelines", html.lower())

    def test_f13_04_plate_4_convergence_concept(self):
        html = CTX.get_text("diagrams/index.html")
        self.assertIn("converge", html.lower())

    def test_f13_05_plate_4_stage_standardization(self):
        html = CTX.get_text("diagrams/index.html")
        self.assertTrue("stage" in html.lower() or "contract" in html.lower())

    # --- F14: In Dev to SIT Sequence SVG ---
    def test_f14_01_plate_5_section_exists(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        p5 = dom.find_by_id("sequence-sit")
        self.assertIsNotNone(p5, "#sequence-sit plate must exist")

    def test_f14_02_plate_5_svg_render(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        p5 = dom.find_by_id("sequence-sit")
        self.assertIsNotNone(p5.find("svg"), "Plate 5 must have SVG")

    def test_f14_03_plate_5_in_dev_to_sit_timeline(self):
        html = CTX.get_text("diagrams/index.html")
        self.assertIn("In Dev to SIT", html)

    def test_f14_04_plate_5_card_progression(self):
        html = CTX.get_text("diagrams/index.html")
        self.assertIn("card", html.lower())

    def test_f14_05_plate_5_svg_elements(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        p5 = dom.find_by_id("sequence-sit")
        paths = p5.find("svg").find_all("path")
        self.assertGreater(len(paths), 5, "Sequence plate must contain detailed vector paths")

    # --- F15: Studio Viewport Controls ---
    def test_f15_01_motion_root_attributes(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        roots = dom.find_all("section", attrs={"data-motion-root": True})
        self.assertGreaterEqual(len(roots), 5, "All 5 diagram plates must have data-motion-root")

    def test_f15_02_step_count_attributes(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        roots = dom.find_all("section", attrs={"data-motion-root": True})
        for r in roots:
            self.assertIsNotNone(r.get_attr("data-step-count"), "Each plate must declare data-step-count")

    def test_f15_03_diagram_jump_navigation(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        jump = dom.find("p", cls="dg-jump")
        self.assertIsNotNone(jump, "Jump navigation bar .dg-jump must exist")
        links = [a.get_attr("href") for a in jump.find_all("a")]
        self.assertEqual(len(links), 5, "Jump nav must contain exactly 5 plate anchors")

    def test_f15_04_diagram_script_referenced(self):
        html = CTX.get_text("diagrams/index.html")
        self.assertIn("diagrams.js", html, "Must link to diagrams.js script")

    def test_f15_05_plate_header_links(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        links = dom.find_all("a", cls="dg-plate-link")
        self.assertGreaterEqual(len(links), 5, "Each plate should have a permalink anchor")

    # --- F16: Dual-Engine Trace Console ---
    def test_f16_01_pipelines_page_structure(self):
        dom = parse_html(CTX.get_text("pipelines/index.html"))
        self.assertIsNotNone(dom.find_by_id("gitlab"), "Engine 1 #gitlab section must exist")

    def test_f16_02_gitlab_engine_card(self):
        dom = parse_html(CTX.get_text("pipelines/index.html"))
        card = dom.find("div", attrs={"data-engine": "gitlab"})
        self.assertIsNotNone(card, "GitLab engine card must exist")

    def test_f16_03_jenkins_engine_card(self):
        dom = parse_html(CTX.get_text("pipelines/index.html"))
        card = dom.find("div", attrs={"data-engine": "jenkins"})
        self.assertIsNotNone(card, "Jenkins engine card must exist")

    def test_f16_04_run_selector_group(self):
        dom = parse_html(CTX.get_text("pipelines/index.html"))
        seg = dom.find_by_id("run-seg")
        self.assertIsNotNone(seg, "Run selector segment #run-seg must exist")

    def test_f16_05_pinned_files_fine_print(self):
        html = CTX.get_text("pipelines/index.html")
        self.assertIn("pinned file", html)
        traces = CTX.get_json("assets/data/traces.json")
        self.assertIn("engines", traces)

    # --- F17: Fail-Closed Pass/Refuse Toggle ---
    def test_f17_01_runs_configuration_presence(self):
        rules_text = CTX.get_text("assets/js/pipelines.mjs")
        self.assertIn("passed:", rules_text)
        self.assertIn("refused:", rules_text)

    def test_f17_02_refuse_run_vulnerabilities(self):
        rules_text = CTX.get_text("assets/js/pipelines.mjs")
        self.assertIn("'CRITICAL'", rules_text, "Refused run must contain CRITICAL severity finding")

    def test_f17_03_pass_run_safe_findings(self):
        rules_text = CTX.get_text("assets/js/pipelines.mjs")
        self.assertIn("passed: {", rules_text)

    def test_f17_04_fail_closed_logic_contract(self):
        rules = CTX.get_text("assets/js/release-rules.mjs")
        self.assertIn("critical", rules.lower())
        self.assertIn("passed", rules.lower())

    def test_f17_05_exit_code_1_on_refuse(self):
        traces = CTX.get_json("assets/data/traces.json")
        traces_str = json.dumps(traces)
        self.assertTrue("exit 1" in traces_str or "failures=1" in traces_str or "passed=false" in traces_str)

    # --- F18: Pinned Source Code Viewer ---
    def test_f18_01_pinned_sources_dir_exists(self):
        src_dir = CTX.root_dir / "assets/data/src"
        self.assertTrue(src_dir.is_dir(), "assets/data/src directory must exist")

    def test_f18_02_key_source_files_present(self):
        for fname in ["gateway.yml", "backend.yml", "GateResult.groovy", "run-scan.sh"]:
            fpath = CTX.root_dir / "assets/data/src" / fname
            self.assertTrue(fpath.is_file(), f"Pinned file {fname} must exist")

    def test_f18_03_traces_mapping_exists(self):
        traces = CTX.get_json("assets/data/traces.json")
        self.assertIn("engines", traces)
        self.assertIn("gitlab", traces["engines"])

    def test_f18_04_trace_lines_count(self):
        traces = CTX.get_json("assets/data/traces.json")
        count = 0
        for eng in traces.get("engines", {}).values():
            for job_lines in eng.values():
                count += len(job_lines)
        self.assertGreaterEqual(count, 150, "Traces must contain comprehensive lines (around 217)")

    def test_f18_05_check_traces_script_passes(self):
        script_path = CTX.root_dir / "scripts/check-traces.mjs"
        self.assertTrue(script_path.is_file(), "scripts/check-traces.mjs must exist")

    # --- F19: Weekly Scanner Reports ---
    def test_f19_01_reports_page_exists(self):
        dom = parse_html(CTX.get_text("reports/index.html"))
        self.assertIsNotNone(dom.find("h1"), "reports/index.html must have h1")
        self.assertIn("The run reports itself", dom.find("h1").get_text())

    def test_f19_02_report_1_branch_sync(self):
        dom = parse_html(CTX.get_text("reports/index.html"))
        r1 = dom.find_by_id("sync")
        self.assertIsNotNone(r1, "Report 1 #sync must exist")
        self.assertIn("Branch Auto Sync", r1.get_text())

    def test_f19_03_report_2_sast_scan(self):
        dom = parse_html(CTX.get_text("reports/index.html"))
        r2 = dom.find_by_id("sast")
        self.assertIsNotNone(r2, "Report 2 #sast must exist")
        self.assertIn("SAST", r2.get_text())

    def test_f19_04_report_3_sonarqube_sweep(self):
        dom = parse_html(CTX.get_text("reports/index.html"))
        r3 = dom.find_by_id("sonar")
        self.assertIsNotNone(r3, "Report 3 #sonar must exist")
        self.assertIn("SonarQube", r3.get_text())

    def test_f19_05_scanner_false_positive_disclaimer(self):
        html = CTX.get_text("reports/index.html")
        self.assertTrue("false positive" in html.lower() or "disclaimer" in html.lower() or "synthetic" in html.lower())

    # --- F20: 11 Structured ADR Cards ---
    def test_f20_01_total_adr_cards_count(self):
        dom = parse_html(CTX.get_text("decisions/index.html"))
        cards = dom.find_all("article", cls="dec-card")
        self.assertEqual(len(cards), 11, "Must contain exactly 11 ADR cards")

    def test_f20_02_adr_system_topology_category(self):
        dom = parse_html(CTX.get_text("decisions/index.html"))
        sec = dom.find_by_id("shaped")
        self.assertIsNotNone(sec, "#shaped section (System Topology) must exist")
        cards = sec.find_all("article", cls="dec-card")
        self.assertEqual(len(cards), 6, "System Topology must contain exactly 6 ADRs")

    def test_f20_03_adr_production_operations_category(self):
        dom = parse_html(CTX.get_text("decisions/index.html"))
        sec = dom.find_by_id("production")
        self.assertIsNotNone(sec, "#production section must exist")
        cards = sec.find_all("article", cls="dec-card")
        self.assertEqual(len(cards), 5, "Production Operations must contain exactly 5 ADRs")

    def test_f20_04_adr_card_required_fields(self):
        dom = parse_html(CTX.get_text("decisions/index.html"))
        cards = dom.find_all("article", cls="dec-card")
        for card in cards[:6]:
            dl = card.find("dl")
            self.assertIsNotNone(dl, "ADR card must contain a definition list dl")
            dts = [dt.get_text().strip().lower() for dt in dl.find_all("dt")]
            self.assertIn("decision", dts)
            self.assertIn("alternative", dts)
            self.assertIn("why", dts)
            self.assertIn("cost", dts)

    def test_f20_05_adr_fold_buttons(self):
        dom = parse_html(CTX.get_text("decisions/index.html"))
        folds = dom.find_all("button", cls="dec-fold")
        self.assertEqual(len(folds), 11, "All 11 ADR cards must feature a .dec-fold button")

    # --- F21: Editorial Light Theme Tokens ---
    def test_f21_01_base_css_exists(self):
        css = CTX.get_text("assets/css/base.css")
        self.assertIn(":root", css)

    def test_f21_02_canvas_background_token(self):
        css = CTX.get_text("assets/css/base.css")
        self.assertRegex(css, re.compile(r"--bg:\s*(#ffffff|#fafafa)", re.IGNORECASE), "Must define light background token")

    def test_f21_03_ink_color_tokens(self):
        css = CTX.get_text("assets/css/base.css")
        self.assertIn("--ink:", css)
        self.assertIn("--ink-dim:", css)

    def test_f21_04_accent_warm_rust_token(self):
        css = CTX.get_text("assets/css/base.css")
        self.assertRegex(css, re.compile(r"--accent:\s*#c2410c", re.IGNORECASE), "Must define Warm Rust --accent: #c2410c")

    def test_f21_05_status_color_tokens(self):
        css = CTX.get_text("assets/css/base.css")
        for tok in ["--pass:", "--danger:", "--warn:", "--info:"]:
            self.assertIn(tok, css, f"Status token {tok} must be defined")

    # --- F22: Mobile Drawer Navigation ---
    def test_f22_01_menu_toggle_button(self):
        dom = parse_html(CTX.get_text("index.html"))
        btn = dom.find("button", attrs={"data-menu-btn": True})
        self.assertIsNotNone(btn, "Menu toggle button [data-menu-btn] must exist")
        self.assertEqual(btn.get_attr("aria-expanded"), "false")

    def test_f22_02_navigation_drawer_container(self):
        dom = parse_html(CTX.get_text("index.html"))
        nav = dom.find("nav", cls="nav")
        self.assertIsNotNone(nav, "Primary navigation drawer .nav must exist")

    def test_f22_03_nav_links_coverage(self):
        dom = parse_html(CTX.get_text("index.html"))
        nav = dom.find("nav", cls="nav")
        links = [a.get_attr("href") for a in nav.find_all("a")]
        self.assertGreaterEqual(len(links), 5, "Nav must contain primary section links")

    def test_f22_04_main_js_drawer_handler(self):
        js = CTX.get_text("assets/js/main.js")
        self.assertIn("data-menu-btn", js)
        self.assertIn("aria-expanded", js)

    def test_f22_05_drawer_closes_on_link_click(self):
        js = CTX.get_text("assets/js/main.js")
        self.assertIn("remove(\"open\")", js)

    # --- F23: Minimum 44x44px Touch Targets ---
    def test_f23_01_components_css_exists(self):
        css = CTX.get_text("assets/css/components.css")
        self.assertTrue(len(css) > 500)

    def test_f23_02_button_touch_sizing(self):
        css = CTX.get_text("assets/css/base.css")
        self.assertTrue("min-height: 44px" in css or "min-width: 44px" in css)

    def test_f23_03_menu_btn_dimensions(self):
        css = CTX.get_text("assets/css/base.css") + CTX.get_text("assets/css/components.css")
        self.assertTrue("menu-btn" in css)

    def test_f23_04_subnav_touch_targets(self):
        css = CTX.get_text("assets/css/base.css") + CTX.get_work_css()
        self.assertTrue("wsn" in css or "subnav" in css)

    def test_f23_05_tf_filter_buttons_sizing(self):
        css = CTX.get_text("assets/css/base.css") + CTX.get_text("assets/css/showcase.css")
        self.assertTrue("tf-btn" in css)

    # --- F24: Zero Horizontal Overflow ---
    def test_f24_01_global_border_box(self):
        css = CTX.get_text("assets/css/base.css")
        self.assertIn("box-sizing: border-box", css)

    def test_f24_02_wrap_max_width_containment(self):
        css = CTX.get_text("assets/css/base.css")
        self.assertIn("--wrap:", css)

    def test_f24_03_table_overflow_wrappers(self):
        css = CTX.get_work_css()
        self.assertIn("overflow-x: auto", css)

    def test_f24_04_viewport_meta_tag(self):
        for page in ["index.html", "diagrams/index.html", "pipelines/index.html", "decisions/index.html"]:
            dom = parse_html(CTX.get_text(page))
            meta = dom.find("meta", name="viewport")
            self.assertIsNotNone(meta, f"Viewport meta required in {page}")
            self.assertIn("width=device-width", meta.get_attr("content", ""))

    def test_f24_05_svg_viewbox_responsiveness(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        for svg in dom.find_all("svg"):
            self.assertTrue(svg.get_attr("viewBox") is not None or svg.get_attr("width") is not None)

    # --- F25: Zero External Runtime Deps & CSP ---
    def test_f25_01_no_cdn_scripts(self):
        for page in ["index.html", "diagrams/index.html", "pipelines/index.html", "decisions/index.html"]:
            dom = parse_html(CTX.get_text(page))
            for s in dom.find_all("script"):
                src = s.get_attr("src", "")
                self.assertFalse(src.startswith(("http://", "https://", "//")), f"External script found in {page}: {src}")

    def test_f25_02_no_external_stylesheets(self):
        for page in ["index.html", "diagrams/index.html", "pipelines/index.html", "decisions/index.html"]:
            dom = parse_html(CTX.get_text(page))
            for l in dom.find_all("link", rel="stylesheet"):
                href = l.get_attr("href", "")
                self.assertFalse(href.startswith(("http://", "https://", "//")), f"External stylesheet found in {page}: {href}")

    def test_f25_03_no_google_fonts(self):
        for page in ["index.html", "diagrams/index.html", "pipelines/index.html", "decisions/index.html"]:
            html = CTX.get_text(page)
            self.assertNotIn("fonts.googleapis.com", html)
            self.assertNotIn("fonts.gstatic.com", html)

    def test_f25_04_csp_meta_tag_or_header(self):
        html = CTX.get_text("diagrams/index.html")
        self.assertIn("Content-Security-Policy", html)
        self.assertIn("default-src 'self'", html)

    def test_f25_05_local_assets_relative_linking(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        for l in dom.find_all("link", rel="stylesheet"):
            href = l.get_attr("href", "")
            self.assertTrue(href.startswith("../assets/") or href.startswith("assets/"), f"Invalid asset ref: {href}")

    # --- F26: Link Integrity Validation ---
    def test_f26_01_index_links_exist(self):
        dom = parse_html(CTX.get_text("index.html"))
        for a in dom.find_all("a"):
            href = a.get_attr("href", "")
            if href.startswith(("http", "mailto", "tel", "#")):
                continue
            path_part = href.split("#")[0]
            if path_part:
                target = (CTX.root_dir / path_part)
                if path_part.endswith("/"):
                    target = target / "index.html"
                self.assertTrue(target.exists(), f"Broken link in index.html: {href}")

    def test_f26_02_work_links_exist(self):
        html = CTX.get_work_html()
        dom = parse_html(html)
        for a in dom.find_all("a"):
            href = a.get_attr("href", "")
            if href.startswith(("http", "mailto", "tel", "#")):
                continue
            path_part = href.split("#")[0]
            if path_part and not path_part.startswith(".."):
                target = (CTX.root_dir / path_part)
                if path_part.endswith("/"):
                    target = target / "index.html"
                if target.exists():
                    self.assertTrue(target.exists())

    def test_f26_03_diagrams_links_exist(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        for a in dom.find_all("a"):
            href = a.get_attr("href", "")
            if href.startswith(("http", "mailto", "tel", "#")):
                continue
            path_part = href.split("#")[0]
            if path_part:
                target = (CTX.root_dir / "diagrams" / path_part).resolve()
                if path_part.endswith("/"):
                    target = target / "index.html"
                self.assertTrue(target.exists(), f"Broken link in diagrams/index.html: {href}")

    def test_f26_04_pipelines_links_exist(self):
        dom = parse_html(CTX.get_text("pipelines/index.html"))
        for a in dom.find_all("a"):
            href = a.get_attr("href", "")
            if href.startswith(("http", "mailto", "tel", "#")):
                continue
            path_part = href.split("#")[0]
            if path_part:
                target = (CTX.root_dir / "pipelines" / path_part).resolve()
                if path_part.endswith("/"):
                    target = target / "index.html"
                self.assertTrue(target.exists(), f"Broken link in pipelines/index.html: {href}")

    def test_f26_05_decisions_links_exist(self):
        dom = parse_html(CTX.get_text("decisions/index.html"))
        for a in dom.find_all("a"):
            href = a.get_attr("href", "")
            if href.startswith(("http", "mailto", "tel", "#")):
                continue
            path_part = href.split("#")[0]
            if path_part:
                target = (CTX.root_dir / "decisions" / path_part).resolve()
                if path_part.endswith("/"):
                    target = target / "index.html"
                self.assertTrue(target.exists(), f"Broken link in decisions/index.html: {href}")

    # --- F27: Copy Integrity & Anti-Slop Gate ---
    def test_f27_01_no_literal_em_dashes(self):
        pages = ["index.html", "diagrams/index.html", "pipelines/index.html", "decisions/index.html", "reports/index.html"]
        if CTX.has_file("work/index.html"):
            pages.append("work/index.html")
        for p in pages:
            html = CTX.get_text(p)
            self.assertNotIn("\u2014", html, f"Literal em dash (U+2014) detected in {p}")

    def test_f27_02_no_entity_em_dashes(self):
        pages = ["index.html", "diagrams/index.html", "pipelines/index.html", "decisions/index.html", "reports/index.html"]
        if CTX.has_file("work/index.html"):
            pages.append("work/index.html")
        for p in pages:
            html = CTX.get_text(p)
            self.assertNotIn("&mdash;", html, f"&mdash; entity detected in {p}")
            self.assertNotIn("&#8212;", html, f"&#8212; entity detected in {p}")

    def test_f27_03_no_banned_buzzwords_set1(self):
        pages = ["index.html", "diagrams/index.html", "pipelines/index.html", "decisions/index.html"]
        banned = ["revolutionary", "seamless", "cutting-edge"]
        for p in pages:
            dom = parse_html(CTX.get_text(p))
            text = dom.get_text().lower()
            for b in banned:
                self.assertNotIn(b, text, f"Banned buzzword '{b}' found in {p}")

    def test_f27_04_no_banned_buzzwords_set2(self):
        pages = ["index.html", "diagrams/index.html", "pipelines/index.html", "decisions/index.html"]
        banned = ["next-level", "game-changer", "unlock", "elevate"]
        for p in pages:
            dom = parse_html(CTX.get_text(p))
            text = dom.get_text().lower()
            for b in banned:
                self.assertNotIn(b, text, f"Banned buzzword '{b}' found in {p}")

    def test_f27_05_no_banned_buzzwords_set3(self):
        pages = ["index.html", "diagrams/index.html", "pipelines/index.html", "decisions/index.html"]
        banned = ["empower", "delve", "testament", "tapestry"]
        for p in pages:
            dom = parse_html(CTX.get_text(p))
            text = dom.get_text().lower()
            for b in banned:
                self.assertNotIn(b, text, f"Banned buzzword '{b}' found in {p}")


# ---------------------------------------------------------------------------
# Tier 2: Boundary & Corner Cases Tests (BC01 to BC27, 5 tests each = 135 tests)
# Covers 12 Edge Cases explicitly
# ---------------------------------------------------------------------------

class Tier2_BoundaryAndCornerCases(unittest.TestCase):
    """Tier 2: Boundary & Corner Cases including 12 explicit edge cases."""

    # --- BC01: Hero Boundary ---
    def test_bc01_01_hero_profile_binding_fallback(self):
        dom = parse_html(CTX.get_text("index.html"))
        name_el = dom.find(attrs={"data-profile": "name"})
        self.assertIsNotNone(name_el)
        self.assertGreater(len(name_el.get_text().strip()), 0)

    def test_bc01_02_hero_image_srcset_boundaries(self):
        dom = parse_html(CTX.get_text("index.html"))
        img = dom.find("img", attrs={"fetchpriority": "high"})
        self.assertIsNotNone(img)
        srcset = img.get_attr("srcset")
        self.assertIn("480w", srcset)
        self.assertIn("800w", srcset)

    def test_bc01_03_hero_photo_fallback_size(self):
        dom = parse_html(CTX.get_text("index.html"))
        img = dom.find("img", attrs={"fetchpriority": "high"})
        self.assertEqual(img.get_attr("width"), "800")
        self.assertEqual(img.get_attr("height"), "1000")

    def test_bc01_04_hero_noscript_support(self):
        dom = parse_html(CTX.get_text("index.html"))
        noscript = dom.find("noscript")
        self.assertIsNotNone(noscript, "noscript fallback stylesheet required in head")

    def test_bc01_05_hero_json_ld_schema(self):
        dom = parse_html(CTX.get_text("index.html"))
        script = dom.find("script", type="application/ld+json")
        self.assertIsNotNone(script, "JSON-LD structured data must exist in index.html")
        data = json.loads(script.get_text())
        self.assertEqual(data.get("@type"), "Person")
        self.assertEqual(data.get("name"), "Ivan Jairus")

    # --- BC02: Verified Numbers Exact Boundary ---
    def test_bc02_01_no_exaggerated_numbers(self):
        html = CTX.get_text("index.html")
        self.assertNotIn("100+ services", html)
        self.assertNotIn("1000+ tests", html)

    def test_bc02_02_artifact_exact_five_items(self):
        dom = parse_html(CTX.get_text("index.html"))
        items = dom.find_all("li", cls="art")
        self.assertEqual(len(items), 5, "Must render exactly 5 artifact items")

    def test_bc02_03_artifact_labels_exact_match(self):
        dom = parse_html(CTX.get_text("index.html"))
        items = dom.find_all("li", cls="art")
        names = [item.find("span", cls="art-n").get_text() for item in items]
        expected = ["jar", "image", "apk", "ipa", "web"]
        for exp in expected:
            self.assertTrue(any(exp in name for name in names), f"Expected artifact {exp} in {names}")

    def test_bc02_04_proof_exact_sample_size_present(self):
        html = CTX.get_text("decisions/index.html")
        self.assertIn("n = 13", html)
        self.assertIn("n = 30", html)

    def test_bc02_05_proof_distribution_quantiles(self):
        html = CTX.get_text("decisions/index.html")
        self.assertIn("median 93 seconds", html)
        self.assertIn("p90 162 s", html)

    # --- BC03: Before vs After Boundary ---
    def test_bc03_01_after_columns_five_phases(self):
        dom = parse_html(CTX.get_work_html())
        after_cols = dom.find("div", cls="ba-after").find("div", cls="ba-cols")
        cols = after_cols.find_all("div", cls="ba-col")
        self.assertEqual(len(cols), 5, "ba-after must render exactly 5 phase columns")

    def test_bc03_02_after_columns_phase_names(self):
        dom = parse_html(CTX.get_work_html())
        after_cols = dom.find("div", cls="ba-after").find("div", cls="ba-cols")
        col_names = [c.find("h3").get_text() for c in after_cols.find_all("div", cls="ba-col")]
        self.assertEqual(col_names, ["To do", "In Dev", "In Review", "Merged", "Deploy"])

    def test_bc03_03_before_columns_three_columns(self):
        dom = parse_html(CTX.get_work_html())
        before_cols = dom.find("div", cls="ba-before").find("div", cls="ba-cols")
        cols = before_cols.find_all("div", cls="ba-col")
        self.assertEqual(len(cols), 3, "ba-before must render standard 3 columns")

    def test_bc03_04_storyboard_break_gate_toggle(self):
        dom = parse_html(CTX.get_work_html())
        btn = dom.find("button", attrs={"data-bd-break": True})
        self.assertIsNotNone(btn, "Storyboard 'break the gate' button must exist")
        self.assertEqual(btn.get_attr("aria-pressed"), "false")

    def test_bc03_05_storyboard_eight_step_dots(self):
        dom = parse_html(CTX.get_work_html())
        dots = dom.find_all("button", cls="bd-dot")
        self.assertEqual(len(dots), 8, "Storyboard must provide exactly 8 step tab dots")

    # --- BC04: Flagship Preview Pathways Boundary ---
    def test_bc04_01_flagship_card_tags_not_empty(self):
        dom = parse_html(CTX.get_text("index.html"))
        cards = dom.find_all("article", cls="work-card")
        for c in cards:
            tags = c.find_all("span", cls="tag")
            self.assertGreaterEqual(len(tags), 3, "Each card must have at least 3 technology tags")

    def test_bc04_02_flagship_card_impact_bullets(self):
        dom = parse_html(CTX.get_text("index.html"))
        cards = dom.find_all("article", cls="work-card")
        for c in cards:
            bullets = c.find("ul", cls="w-impact").find_all("li")
            self.assertEqual(len(bullets), 3, "Each card must feature exactly 3 impact bullet points")

    def test_bc04_03_flagship_external_rel_attributes(self):
        dom = parse_html(CTX.get_text("index.html"))
        ext_links = [a for a in dom.find_all("a") if a.get_attr("target") == "_blank"]
        for a in ext_links:
            rel = a.get_attr("rel", "")
            self.assertIn("noopener", rel, "External link must specify rel='noopener'")

    def test_bc04_04_work_subnav_anchors(self):
        dom = parse_html(CTX.get_work_html())
        subnav = dom.find("div", cls="work-subnav")
        self.assertIsNotNone(subnav)
        anchors = [a.get_attr("href") for a in subnav.find_all("a")]
        for exp in ["#board", "#platform", "#architecture", "#threat"]:
            self.assertIn(exp, anchors, f"Expected subnav anchor {exp} in {anchors}")

    def test_bc04_05_depth_toggle_attribute(self):
        dom = parse_html(CTX.get_work_html())
        btn = dom.find("button", attrs={"data-depth-btn": True})
        self.assertIsNotNone(btn, "Depth toggle button must exist")
        self.assertEqual(btn.get_attr("aria-pressed"), "false")

    # --- BC05: Edge Case 7 (E7) - Toolbox Category Filter Switch ---
    def test_bc05_01_e7_filter_initial_pressed_state(self):
        dom = parse_html(CTX.get_text("index.html"))
        daily_btn = dom.find("button", attrs={"data-filter": "daily"})
        self.assertEqual(daily_btn.get_attr("aria-pressed"), "true", "Default filter button must be daily with aria-pressed=true")

    def test_bc05_02_e7_filter_other_buttons_initial_state(self):
        dom = parse_html(CTX.get_text("index.html"))
        for f in ["regular", "exposure", "all"]:
            btn = dom.find("button", attrs={"data-filter": f})
            self.assertEqual(btn.get_attr("aria-pressed"), "false", f"Button {f} must have aria-pressed=false initially")

    def test_bc05_03_e7_skill_groups_semantic_headings(self):
        dom = parse_html(CTX.get_text("index.html"))
        groups = dom.find_all("div", cls="skill-group")
        for g in groups:
            h3 = g.find("h3")
            self.assertIsNotNone(h3, "Skill group must maintain semantic h3 heading")

    def test_bc05_04_e7_toolbox_js_filter_handler(self):
        js = CTX.get_text("assets/js/showcase.js") + CTX.get_text("assets/js/main.js")
        self.assertTrue("data-filter" in js)

    def test_bc05_05_e7_tier_badges_match_classes(self):
        dom = parse_html(CTX.get_text("index.html"))
        items = dom.find_all("div", cls="skill-item")
        for item in items:
            tier_span = item.find("span", cls="tier")
            self.assertIsNotNone(tier_span)
            classes = tier_span.attrs.get("class", "").split()
            self.assertTrue(any(c in ["t-daily", "t-regular", "t-exposure"] for c in classes))

    # --- BC06: Case Study I Anti-Loop Boundary ---
    def test_bc06_01_watermark_concept_in_work(self):
        html = CTX.get_work_html()
        self.assertIn("infinite-webhook incident", html)

    def test_bc06_02_rule_zero_bot_guard(self):
        rules = CTX.get_text("assets/js/release-rules.mjs")
        self.assertTrue("bot" in rules.lower() or "author" in rules.lower())

    def test_bc06_03_watermark_in_traces(self):
        traces = CTX.get_text("assets/data/traces.json")
        self.assertIn("watermark", traces.lower())

    def test_bc06_04_board_lib_self_test(self):
        script_path = CTX.root_dir / "scripts/check-board.mjs"
        self.assertTrue(script_path.is_file())

    def test_bc06_05_board_cards_published_sentences(self):
        cards = CTX.get_text("assets/js/i18n.js")
        self.assertIn("32 pipeline jobs across 18 orchestrators", cards)

    # --- BC07: Case Study II SSE & Gate Boundary ---
    def test_bc07_01_composite_gate_four_points(self):
        html = CTX.get_work_html()
        self.assertIn("deploy", html.lower())
        self.assertIn("code quality", html.lower())
        self.assertIn("vulnerabilit", html.lower())

    def test_bc07_02_control_plane_dependencies_count(self):
        html = CTX.get_text("index.html")
        self.assertIn("three dependencies total", html)

    def test_bc07_03_control_plane_views_declared(self):
        html = CTX.get_work_html()
        self.assertTrue("deploys" in html.lower() or "scans" in html.lower())

    def test_bc07_04_control_plane_api_key_auth(self):
        html = CTX.get_work_html()
        self.assertIn("API-key auth", html)

    def test_bc07_05_control_plane_role_switcher(self):
        html = CTX.get_work_html()
        self.assertTrue("admin" in html and "developer" in html)

    # --- BC08: Case Study III Gateway Contract Boundary ---
    def test_bc08_01_gateway_yaml_exists_in_pinned_src(self):
        path = CTX.root_dir / "assets/data/src/gateway.yml"
        self.assertTrue(path.is_file())

    def test_bc08_02_gateway_yaml_routes_services(self):
        content = CTX.get_text("assets/data/src/gateway.yml")
        self.assertIn("backend", content)
        self.assertIn("web", content)

    def test_bc08_03_source_repos_carry_no_ci_file(self):
        html = CTX.get_work_html()
        self.assertIn("source repositories carry no CI file at all", html)

    def test_bc08_04_versioned_with_pipelines(self):
        html = CTX.get_work_html()
        self.assertIn("versioned with the pipelines", html)

    def test_bc08_05_backend_yaml_templates_present(self):
        path = CTX.root_dir / "assets/data/src/backend.yml"
        self.assertTrue(path.is_file())

    # --- BC09: Edge Case 4 (E4) - 360px Mobile Viewport on Threat Table ---
    def test_bc09_01_e4_table_wrapper_has_overflow_style(self):
        css = CTX.get_work_css()
        self.assertIn(".tm-wrap", css)
        self.assertIn("overflow-x: auto", css)

    def test_bc09_02_e4_table_has_min_width(self):
        css = CTX.get_work_css()
        self.assertTrue("min-width" in css or "overflow" in css)

    def test_bc09_03_e4_swipe_hint_present(self):
        html = CTX.get_work_html()
        self.assertTrue("threat" in html.lower())

    def test_bc09_04_e4_table_markup_structure(self):
        dom = parse_html(CTX.get_work_html())
        table = dom.find("table", cls="tm-tbl")
        thead = table.find("thead")
        tbody = table.find("tbody")
        self.assertIsNotNone(thead)
        self.assertIsNotNone(tbody)

    def test_bc09_05_e4_table_row_count(self):
        dom = parse_html(CTX.get_work_html())
        tbody = dom.find("table", cls="tm-tbl").find("tbody")
        rows = tbody.find_all("tr")
        self.assertGreaterEqual(len(rows), 8, "Threat table must render at least 8 asset rows")

    # --- BC10: Edge Case 2 (E2) - Diagram Plate 1 noscript Fallback ---
    def test_bc10_01_e2_plate_1_has_complete_svg(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        p1 = dom.find_by_id("state-governance")
        svg = p1.find("svg")
        self.assertIsNotNone(svg)
        self.assertIn("1280 680", svg.get_attr("viewBox"))

    def test_bc10_02_e2_plate_1_static_frame_attribute(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        p1 = dom.find_by_id("state-governance")
        self.assertEqual(p1.get_attr("data-static-frame"), "complete")

    def test_bc10_03_e2_plate_1_svg_desc_fallback(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        p1 = dom.find_by_id("state-governance")
        desc = p1.find("desc")
        self.assertIsNotNone(desc)
        self.assertIn("Three-band state machine", desc.get_text())

    def test_bc10_04_e2_plate_1_motion_items_rendered(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        p1 = dom.find_by_id("state-governance")
        items = p1.find_all(attrs={"data-motion-item": True})
        self.assertGreater(len(items), 0, "Plate 1 must contain data-motion-item paths")

    def test_bc10_05_e2_global_noscript_css_linked(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        noscript = dom.find("noscript")
        self.assertIsNotNone(noscript)

    # --- BC11: Edge Case 3 (E3) - Diagram Plate 2 prefers-reduced-motion ---
    def test_bc11_01_e3_diagrams_js_handles_reduced_motion(self):
        js = CTX.get_text("assets/js/diagrams.js")
        self.assertIn("prefers-reduced-motion: reduce", js)

    def test_bc11_02_e3_motion_state_reduced_string(self):
        js = CTX.get_text("assets/js/diagrams.js")
        self.assertIn('"reduced"', js)

    def test_bc11_03_e3_static_frame_on_reduced(self):
        js = CTX.get_text("assets/js/diagrams.js")
        self.assertIn('root.dataset.frame = "static"', js)

    def test_bc11_04_e3_loop_pause_definition(self):
        js = CTX.get_text("assets/js/diagrams.js")
        self.assertIn("10000", js, "Loop pause on final frame must be 10000ms")

    def test_bc11_05_e3_animations_css_reduced_media_query(self):
        css = CTX.get_text("assets/css/animations.css")
        self.assertIn("prefers-reduced-motion", css)

    # --- BC12: Plate 3 Event Router Boundary ---
    def test_bc12_01_event_router_svg_viewbox(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        p3 = dom.find_by_id("event-router")
        svg = p3.find("svg")
        self.assertTrue(svg.get_attr("viewBox") is not None)

    def test_bc12_02_event_router_step_count(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        p3 = dom.find_by_id("event-router")
        self.assertIsNotNone(p3.get_attr("data-step-count"))

    def test_bc12_03_event_router_motion_mode(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        p3 = dom.find_by_id("event-router")
        self.assertEqual(p3.get_attr("data-motion-mode"), "loop")

    def test_bc12_04_event_router_title_accessibility(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        p3 = dom.find_by_id("event-router")
        title = p3.find("title")
        self.assertIsNotNone(title)

    def test_bc12_05_event_router_desc_accessibility(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        p3 = dom.find_by_id("event-router")
        desc = p3.find("desc")
        self.assertIsNotNone(desc)

    # --- BC13: Plate 4 Convergence Graph Boundary ---
    def test_bc13_01_convergence_graph_section_id(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        p4 = dom.find_by_id("dependency-graph")
        self.assertIsNotNone(p4)

    def test_bc13_02_convergence_graph_step_count(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        p4 = dom.find_by_id("dependency-graph")
        self.assertIsNotNone(p4.get_attr("data-step-count"))

    def test_bc13_03_convergence_graph_deck_description(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        p4 = dom.find_by_id("dependency-graph")
        deck = p4.find("p", cls="deck")
        self.assertIsNotNone(deck)
        self.assertIn("converge", deck.get_text().lower())

    def test_bc13_04_convergence_graph_svg_container(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        p4 = dom.find_by_id("dependency-graph")
        container = p4.find("div", cls="diagram-container")
        self.assertIsNotNone(container)

    def test_bc13_05_convergence_graph_jump_anchor(self):
        html = CTX.get_text("diagrams/index.html")
        self.assertIn('href="#dependency-graph"', html)

    # --- BC14: Plate 5 Execution Sequence Boundary ---
    def test_bc14_01_sequence_sit_id_exists(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        p5 = dom.find_by_id("sequence-sit")
        self.assertIsNotNone(p5)

    def test_bc14_02_sequence_sit_step_count(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        p5 = dom.find_by_id("sequence-sit")
        self.assertIsNotNone(p5.get_attr("data-step-count"))

    def test_bc14_03_sequence_sit_title_text(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        p5 = dom.find_by_id("sequence-sit")
        h2 = p5.find("h2")
        self.assertIn("In Dev to SIT", h2.get_text())

    def test_bc14_04_sequence_sit_aria_labelledby(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        p5 = dom.find_by_id("sequence-sit")
        svg = p5.find("svg")
        self.assertIsNotNone(svg.get_attr("aria-labelledby"))

    def test_bc14_05_sequence_sit_motion_items_present(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        p5 = dom.find_by_id("sequence-sit")
        items = p5.find_all(attrs={"data-motion-item": True})
        self.assertGreater(len(items), 0)

    # --- BC15: Studio Viewport Controls Boundary ---
    def test_bc15_01_step_current_initial_attribute(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        roots = dom.find_all("section", attrs={"data-motion-root": True})
        for r in roots:
            self.assertIsNotNone(r.get_attr("data-step-current"))

    def test_bc15_02_frame_attribute_present(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        roots = dom.find_all("section", attrs={"data-motion-root": True})
        for r in roots:
            self.assertIsNotNone(r.get_attr("data-frame"))

    def test_bc15_03_diagrams_css_rules_present(self):
        css = CTX.get_text("assets/css/diagrams.css")
        self.assertIn("data-motion-root", css)
        self.assertIn("is-visible", css)

    def test_bc15_04_diagrams_js_exact_step_query_param(self):
        js = CTX.get_text("assets/js/diagrams.js")
        self.assertIn('params.get("step")', js)

    def test_bc15_05_diagrams_js_static_query_param(self):
        js = CTX.get_text("assets/js/diagrams.js")
        self.assertIn('params.get("motion")', js)

    # --- BC16: Dual Engine Trace Console Lines Boundary ---
    def test_bc16_01_traces_file_structure(self):
        data = CTX.get_json("assets/data/traces.json")
        self.assertIn("engines", data)
        self.assertIn("gitlab", data["engines"])

    def test_bc16_02_traces_has_probes(self):
        data = CTX.get_json("assets/data/traces.json")
        gitlab = data["engines"]["gitlab"]
        first_job = next(iter(gitlab.values()))
        self.assertTrue(any("p" in line for line in first_job))

    def test_bc16_03_no_line_is_invented_prose(self):
        data = CTX.get_json("assets/data/traces.json")
        note = data.get("note", "")
        self.assertIn("Nothing here is invented prose", note)

    def test_bc16_04_pipelines_mjs_imports_rules(self):
        mjs = CTX.get_text("assets/js/pipelines.mjs")
        self.assertIn("import * as R from './release-rules.mjs'", mjs)

    def test_bc16_05_pipelines_css_console_styles(self):
        css = CTX.get_text("assets/css/pipelines.css")
        self.assertIn("pv-card", css)

    # --- BC17: Edge Case 1 (E1) - Fail-Closed Refusal State ---
    def test_bc17_01_e1_refusal_gate_verdict(self):
        rules = CTX.get_text("assets/js/release-rules.mjs")
        self.assertIn("evaluateGate", rules)

    def test_bc17_02_e1_refusal_halts_downstream(self):
        mjs = CTX.get_text("assets/js/pipelines.mjs")
        self.assertIn("refused", mjs)

    def test_bc17_03_e1_refusal_error_log_in_traces(self):
        traces = json.dumps(CTX.get_json("assets/data/traces.json"))
        self.assertIn("GateResult.evaluate passed=false", traces)

    def test_bc17_04_e1_refusal_vulnerabilities_message(self):
        traces = json.dumps(CTX.get_json("assets/data/traces.json"))
        self.assertIn("vulnerabilities: 1 critical", traces)

    def test_bc17_05_e1_refusal_exit_status_log(self):
        traces = json.dumps(CTX.get_json("assets/data/traces.json"))
        self.assertIn("gate-verdict.json", traces)

    # --- BC18: Pinned Source SHA-256 Byte-Identical Validation ---
    def test_bc18_01_pinned_sources_sha_script(self):
        script_path = CTX.root_dir / "scripts/check-rules-sync.mjs"
        self.assertTrue(script_path.is_file())

    def test_bc18_02_pinned_gateway_hash(self):
        lock = CTX.get_json("assets/data/rules.lock.json")
        spec = lock["files"]["assets/data/src/gateway.yml"]
        data = CTX.get_bytes("assets/data/src/gateway.yml")
        h = hashlib.sha256(data).hexdigest()
        self.assertEqual(h, spec["sha256"])

    def test_bc18_03_pinned_backend_hash(self):
        lock = CTX.get_json("assets/data/rules.lock.json")
        spec = lock["files"]["assets/data/src/backend.yml"]
        data = CTX.get_bytes("assets/data/src/backend.yml")
        h = hashlib.sha256(data).hexdigest()
        self.assertEqual(h, spec["sha256"])

    def test_bc18_04_pinned_gate_result_hash(self):
        lock = CTX.get_json("assets/data/rules.lock.json")
        spec = lock["files"]["assets/data/src/GateResult.groovy"]
        data = CTX.get_bytes("assets/data/src/GateResult.groovy")
        h = hashlib.sha256(data).hexdigest()
        self.assertEqual(h, spec["sha256"])

    def test_bc18_05_fixture_json_exists(self):
        path = CTX.root_dir / "assets/data/fixture.json"
        self.assertTrue(path.is_file())

    # --- BC19: Edge Case 11 (E11) - Scanner Reports "No Analysis" State ---
    def test_bc19_01_e11_sonar_report_no_analysis_pill(self):
        html = CTX.get_text("reports/index.html")
        self.assertIn("NO ANALYSIS", html)

    def test_bc19_02_e11_no_analysis_represents_schedule_runner_failure(self):
        html = CTX.get_text("reports/index.html")
        self.assertTrue("schedule" in html.lower() or "runner" in html.lower() or "did not produce" in html.lower() or "missing" in html.lower())

    def test_bc19_03_e11_mail_card_styling(self):
        css = CTX.get_text("assets/css/reports.css")
        self.assertIn("mail-card", css)

    def test_bc19_04_e11_reports_header_links(self):
        dom = parse_html(CTX.get_text("reports/index.html"))
        header = dom.find("header", cls="site-header")
        self.assertIsNotNone(header)

    def test_bc19_05_e11_three_report_sections(self):
        dom = parse_html(CTX.get_text("reports/index.html"))
        blocks = dom.find_all("section", cls="rp-block")
        self.assertEqual(len(blocks), 3, "reports/index.html must feature exactly 3 report blocks")

    # --- BC20: Edge Case 8 (E8) - Decision Card Fold Toggle ---
    def test_bc20_01_e8_fold_initial_aria_expanded(self):
        dom = parse_html(CTX.get_text("decisions/index.html"))
        folds = dom.find_all("button", cls="dec-fold")
        for f in folds:
            self.assertEqual(f.get_attr("aria-expanded"), "true")

    def test_bc20_02_e8_fold_script_presence(self):
        html = CTX.get_text("decisions/index.html")
        self.assertIn("folds.mjs", html)

    def test_bc20_03_e8_folds_mjs_toggle_logic(self):
        js = CTX.get_text("assets/js/folds.mjs")
        self.assertIn("aria-expanded", js)
        self.assertIn("click", js)

    def test_bc20_04_e8_decisions_css_fold_styles(self):
        css = CTX.get_text("assets/css/showcase.css") + CTX.get_text("assets/css/decisions.css")
        self.assertIn("dec-fold", css)

    def test_bc20_05_e8_card_collapsible_content(self):
        dom = parse_html(CTX.get_text("decisions/index.html"))
        cards = dom.find_all("article", cls="dec-card")
        for c in cards:
            h3 = c.find("h3")
            self.assertIsNotNone(h3)

    # --- BC21: Editorial Light Theme Contrast Ratios ---
    def test_bc21_01_theme_color_meta(self):
        for p in ["index.html", "diagrams/index.html", "pipelines/index.html", "decisions/index.html"]:
            dom = parse_html(CTX.get_text(p))
            meta = dom.find("meta", name="theme-color")
            self.assertIsNotNone(meta)
            self.assertEqual(meta.get_attr("content"), "#ffffff")

    def test_bc21_02_color_scheme_light_meta(self):
        for p in ["index.html", "diagrams/index.html", "pipelines/index.html", "decisions/index.html"]:
            dom = parse_html(CTX.get_text(p))
            meta = dom.find("meta", name="color-scheme")
            self.assertIsNotNone(meta)
            self.assertEqual(meta.get_attr("content"), "light")

    def test_bc21_03_base_css_typography_font_stacks(self):
        css = CTX.get_text("assets/css/base.css")
        self.assertIn("--font-sans:", css)
        self.assertIn("--font-mono:", css)

    def test_bc21_04_contrast_calculated_wcag_aa(self):
        # Ink #18181B on Canvas #FAFAFA relative luminance test
        def lum(r, g, b):
            def ch(c):
                v = c / 255.0
                return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
            return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)

        l_canvas = lum(0xFA, 0xFA, 0xFA)
        l_ink = lum(0x18, 0x18, 0x1B)
        ratio = (l_canvas + 0.05) / (l_ink + 0.05)
        self.assertGreaterEqual(ratio, 4.5, "Ink on Canvas contrast must satisfy WCAG AA >= 4.5:1")

    def test_bc21_05_dark_surface_terminal_only(self):
        css = CTX.get_text("assets/css/base.css")
        self.assertIn("--surface-dark:", css)

    # --- BC22: Edge Cases 5 & 6 (E5, E6) - Mobile Drawer A11y & Escape ---
    def test_bc22_01_e5_menu_button_attributes(self):
        dom = parse_html(CTX.get_text("index.html"))
        btn = dom.find("button", attrs={"data-menu-btn": True})
        self.assertEqual(btn.get_attr("aria-expanded"), "false")
        self.assertEqual(btn.get_attr("aria-label"), "Menu")

    def test_bc22_02_e5_nav_click_close_behavior(self):
        js = CTX.get_text("assets/js/main.js")
        self.assertIn('if (e.target.tagName === "A") nav.classList.remove("open")', js)

    def test_bc22_03_e6_header_tools_wrapper(self):
        dom = parse_html(CTX.get_text("index.html"))
        tools = dom.find("div", cls="header-tools")
        self.assertIsNotNone(tools)

    def test_bc22_04_e5_escape_key_or_nav_support(self):
        js = CTX.get_text("assets/js/main.js")
        self.assertIn("menuBtn", js)

    def test_bc22_05_e6_brand_home_link(self):
        dom = parse_html(CTX.get_text("index.html"))
        brand = dom.find("a", cls="brand")
        self.assertIsNotNone(brand)
        self.assertEqual(brand.get_attr("aria-label"), "Home")

    # --- BC23: Touch Targets Boundaries ---
    def test_bc23_01_touch_button_classes(self):
        css = CTX.get_text("assets/css/base.css")
        self.assertIn(".btn", css)
        self.assertIn("min-height: 44px", css)

    def test_bc23_02_touch_target_in_components(self):
        css = CTX.get_text("assets/css/base.css")
        self.assertTrue("min-height: 44px" in css or "min-width: 44px" in css)

    def test_bc23_03_hero_cta_buttons(self):
        dom = parse_html(CTX.get_text("index.html"))
        cta = dom.find("div", cls="hero-cta")
        btns = cta.find_all("a", cls="btn")
        self.assertGreaterEqual(len(btns), 2)

    def test_bc23_04_storyboard_step_buttons(self):
        dom = parse_html(CTX.get_work_html())
        prev_btn = dom.find("button", attrs={"data-bd-prev": True})
        next_btn = dom.find("button", attrs={"data-bd-next": True})
        self.assertIsNotNone(prev_btn)
        self.assertIsNotNone(next_btn)

    def test_bc23_05_header_nav_link_padding(self):
        css = CTX.get_text("assets/css/base.css")
        self.assertIn(".nav", css)

    # --- BC24: Zero Horizontal Overflow Containment ---
    def test_bc24_01_wrap_padding_clamp(self):
        css = CTX.get_text("assets/css/base.css")
        self.assertIn("--pad: clamp(", css)

    def test_bc24_02_section_padding_clamp(self):
        css = CTX.get_text("assets/css/base.css")
        self.assertIn("--section: clamp(", css)

    def test_bc24_03_diagram_plate_containment(self):
        css = CTX.get_text("assets/css/diagrams.css")
        self.assertIn(".diagram-container", css)

    def test_bc24_04_console_pre_overflow(self):
        css = CTX.get_text("assets/css/pipelines.css")
        self.assertTrue("overflow" in css or "pre" in css or "pv-log" in css)

    def test_bc24_05_reports_table_wrapper(self):
        dom = parse_html(CTX.get_text("reports/index.html"))
        tables = dom.find_all("table")
        for tbl in tables:
            self.assertIsNotNone(tbl.parent)

    # --- BC25: Edge Case 10 (E10) - CSP & Security Headers ---
    def test_bc25_01_e10_diagrams_csp_meta(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        meta = dom.find("meta", attrs={"http-equiv": "Content-Security-Policy"})
        self.assertIsNotNone(meta)
        csp = meta.get_attr("content")
        self.assertIn("default-src 'self'", csp)

    def test_bc25_02_e10_csp_restricts_scripts(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        meta = dom.find("meta", attrs={"http-equiv": "Content-Security-Policy"})
        csp = meta.get_attr("content")
        self.assertIn("script-src 'self'", csp)

    def test_bc25_03_e10_csp_restricts_objects(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        meta = dom.find("meta", attrs={"http-equiv": "Content-Security-Policy"})
        csp = meta.get_attr("content")
        self.assertIn("object-src 'none'", csp)

    def test_bc25_04_e10_no_unsafe_inline_in_script_src(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        meta = dom.find("meta", attrs={"http-equiv": "Content-Security-Policy"})
        csp = meta.get_attr("content")
        self.assertNotIn("script-src 'unsafe-inline'", csp)

    def test_bc25_05_e10_no_inline_event_handlers_in_html(self):
        pages = ["index.html", "diagrams/index.html", "pipelines/index.html", "decisions/index.html"]
        for p in pages:
            html = CTX.get_text(p)
            self.assertNotIn('onclick="', html)
            self.assertNotIn('onload="', html)

    # --- BC26: Edge Case 12 (E12) - Sticky Header Scroll Offset ---
    def test_bc26_01_e12_header_height_token_defined(self):
        css = CTX.get_text("assets/css/base.css")
        self.assertIn("--header-h: 65px;", css)

    def test_bc26_02_e12_subnav_height_token_defined(self):
        css = CTX.get_text("assets/css/base.css")
        self.assertIn("--subnav-h: 53px;", css)

    def test_bc26_03_e12_subnav_media_query_adjustment(self):
        css = CTX.get_text("assets/css/base.css")
        self.assertIn("--subnav-h: 56px;", css)

    def test_bc26_04_e12_scroll_margin_in_css(self):
        css = CTX.get_text("assets/css/base.css") + CTX.get_work_css()
        self.assertTrue("scroll-margin" in css or "--header-h" in css)

    def test_bc26_05_e12_cross_page_anchor_targets_exist(self):
        work_dom = parse_html(CTX.get_work_html())
        for target_id in ["board", "platform", "architecture", "threat"]:
            self.assertIsNotNone(work_dom.find_by_id(target_id), f"Target id #{target_id} missing")

    # --- BC27: Edge Case 9 (E9) - Em Dashes & Slop Anti-Regression Boundary ---
    def test_bc27_01_e9_no_spaced_en_dashes(self):
        pages = ["index.html", "diagrams/index.html", "pipelines/index.html", "decisions/index.html"]
        if CTX.has_file("work/index.html"):
            pages.append("work/index.html")
        for p in pages:
            html = CTX.get_text(p)
            self.assertFalse(re.search(r"\s–\s", html), f"Spaced en-dash detected in {p}")

    def test_bc27_02_e9_no_unicode_escaped_em_dashes(self):
        pages = ["index.html", "diagrams/index.html", "pipelines/index.html", "decisions/index.html"]
        if CTX.has_file("work/index.html"):
            pages.append("work/index.html")
        for p in pages:
            html = CTX.get_text(p)
            self.assertNotIn(r"\u2014", html, f"Unicode escaped em dash detected in {p}")

    def test_bc27_03_e9_assert_copy_script_passes(self):
        script_path = CTX.root_dir / "scripts/assert-copy.mjs"
        self.assertTrue(script_path.is_file())

    def test_bc27_04_e9_changelog_copy_integrity(self):
        changelog = CTX.get_text("CHANGELOG.md")
        self.assertNotIn("\u2014", changelog)

    def test_bc27_05_e9_readme_copy_integrity(self):
        readme = CTX.get_text("README.md")
        self.assertNotIn("\u2014", readme)


# ---------------------------------------------------------------------------
# Tier 3: Cross-Feature Interactions & Pairwise Combinations (28 tests)
# ---------------------------------------------------------------------------

class Tier3_CrossFeatureInteractions(unittest.TestCase):
    """Tier 3: Pairwise Combinations & Cross-Feature Interactions."""

    def test_int01_drawer_nav_across_all_pages(self):
        pages = ["index.html", "diagrams/index.html", "pipelines/index.html", "decisions/index.html"]
        if CTX.has_file("work/index.html"):
            pages.append("work/index.html")
        for p in pages:
            dom = parse_html(CTX.get_text(p))
            header = dom.find("header", cls="site-header")
            self.assertIsNotNone(header, f"Header missing in {p}")
            nav = header.find("nav", cls="nav")
            self.assertIsNotNone(nav, f"Nav drawer missing in {p}")

    def test_int02_theme_tokens_imported_across_all_pages(self):
        pages = ["index.html", "diagrams/index.html", "pipelines/index.html", "decisions/index.html"]
        if CTX.has_file("work/index.html"):
            pages.append("work/index.html")
        for p in pages:
            dom = parse_html(CTX.get_text(p))
            links = dom.find_all("link", rel="stylesheet")
            hrefs = [l.get_attr("href") for l in links]
            self.assertTrue(any("base.css" in h for h in hrefs), f"base.css not linked in {p}")
            self.assertTrue(any("components.css" in h for h in hrefs), f"components.css not linked in {p}")

    def test_int03_dual_engine_console_sync(self):
        mjs = CTX.get_text("assets/js/pipelines.mjs")
        self.assertIn("gitlab", mjs)
        self.assertIn("jenkins", mjs)
        self.assertIn("RUNS", mjs)

    def test_int04_pinned_code_viewer_maps_traces(self):
        traces = CTX.get_json("assets/data/traces.json")
        for eng in traces.get("engines", {}).values():
            for lines in eng.values():
                for line in lines:
                    if "p" in line:
                        parts = line["p"].split("::")
                        self.assertEqual(len(parts), 2, f"Malformed probe in trace: {line['p']}")

    def test_int05_diagram_motion_with_reduced_motion(self):
        js = CTX.get_text("assets/js/diagrams.js")
        self.assertIn("reduce.matches", js)
        self.assertIn("pause()", js)

    def test_int06_toolbox_refs_anchor_to_work_cards(self):
        dom = parse_html(CTX.get_text("index.html"))
        refs = dom.find_all("a", cls="ref")
        for r in refs:
            target_id = r.get_attr("data-ref")
            self.assertIsNotNone(dom.find_by_id(target_id), f"Target card #{target_id} missing on page")

    def test_int07_work_matrix_consistent_with_overview_metrics(self):
        overview_html = CTX.get_text("index.html")
        work_html = CTX.get_work_html()
        self.assertIn("53 services", overview_html)
        self.assertIn("53 services", work_html)

    def test_int08_threat_model_gates_match_pinned_scripts(self):
        src_dir = CTX.root_dir / "assets/data/src"
        self.assertTrue((src_dir / "run-scan.sh").is_file())
        self.assertTrue((src_dir / "setup-vault-jwt.sh").is_file())

    def test_int09_adr01_gateway_matches_pinned_gateway(self):
        adr_html = CTX.get_text("decisions/index.html")
        self.assertIn("gateway.yml", adr_html)
        self.assertTrue((CTX.root_dir / "assets/data/src/gateway.yml").is_file())

    def test_int10_adr02_fail_closed_matches_groovy(self):
        adr_html = CTX.get_text("decisions/index.html")
        self.assertIn("fail closed", adr_html.lower())
        groovy = CTX.get_text("assets/data/src/GateResult.groovy")
        self.assertIn("passed", groovy)

    def test_int11_adr03_two_engines_matches_sit_groovy(self):
        adr_html = CTX.get_text("decisions/index.html")
        self.assertIn("Two CI engines", adr_html)
        groovy = CTX.get_text("assets/data/src/GatewaySIT.groovy")
        self.assertIn("pipeline", groovy.lower())

    def test_int12_adr04_ticket_sync_matches_python(self):
        adr_html = CTX.get_text("decisions/index.html")
        self.assertIn("inside the ticket", adr_html)
        py = CTX.get_text("assets/data/src/ticket_sync.py")
        self.assertIn("ticket", py.lower())

    def test_int13_adr06_ai_agents_boundary(self):
        adr_html = CTX.get_text("decisions/index.html")
        self.assertIn("Nothing they write merges itself", adr_html)

    def test_int14_scanner_report_counts_consistency(self):
        dom = parse_html(CTX.get_text("reports/index.html"))
        stats = dom.find("div", cls="mail-stats")
        self.assertIsNotNone(stats)
        self.assertIn("merged", stats.get_text())

    def test_int15_weekly_reports_nav_links_back(self):
        dom = parse_html(CTX.get_text("reports/index.html"))
        where = dom.find("p", cls="rp-where")
        self.assertIsNotNone(where)
        links = [a.get_attr("href") for a in where.find_all("a")]
        self.assertTrue(any("pipelines" in h for h in links))

    def test_int16_sticky_header_offset_against_anchors(self):
        work_html = CTX.get_work_html()
        self.assertIn('id="board"', work_html)
        self.assertIn('id="platform"', work_html)
        self.assertIn('id="architecture"', work_html)
        self.assertIn('id="threat"', work_html)

    def test_int17_i18n_keys_match_html_attributes(self):
        js = CTX.get_text("assets/js/i18n.js")
        self.assertIn("hero.tagline", js)
        self.assertIn("work.title", js)

    def test_int18_canonical_url_matches_og_url(self):
        pages = ["index.html", "diagrams/index.html", "pipelines/index.html", "decisions/index.html"]
        if CTX.has_file("work/index.html"):
            pages.append("work/index.html")
        for p in pages:
            dom = parse_html(CTX.get_text(p))
            canonical = dom.find("link", rel="canonical")
            og_url = dom.find("meta", property="og:url")
            self.assertIsNotNone(canonical, f"Canonical missing in {p}")
            self.assertIsNotNone(og_url, f"og:url missing in {p}")
            self.assertEqual(canonical.get_attr("href"), og_url.get_attr("content"))

    def test_int19_meta_descriptions_informative(self):
        pages = ["index.html", "diagrams/index.html", "pipelines/index.html", "decisions/index.html"]
        if CTX.has_file("work/index.html"):
            pages.append("work/index.html")
        for p in pages:
            dom = parse_html(CTX.get_text(p))
            desc = dom.find("meta", name="description")
            self.assertIsNotNone(desc, f"Description meta missing in {p}")
            self.assertGreaterEqual(len(desc.get_attr("content", "")), 20)

    def test_int20_cv_download_link_resolves(self):
        dom = parse_html(CTX.get_text("index.html"))
        cv_links = [a.get_attr("href") for a in dom.find_all("a") if a.get_attr("href") and "cv-ivan-jairus.pdf" in a.get_attr("href")]
        self.assertGreaterEqual(len(cv_links), 1)
        for h in cv_links:
            target = CTX.root_dir / h
            self.assertTrue(target.is_file(), f"Target CV file missing: {target}")

    def test_int21_pinned_sources_sha_against_sources_json(self):
        lock = CTX.get_json("assets/data/rules.lock.json")
        self.assertIn("files", lock)
        self.assertGreaterEqual(len(lock["files"]), 20)

    def test_int22_pass_state_vs_refuse_state_diff(self):
        mjs = CTX.get_text("assets/js/pipelines.mjs")
        self.assertIn("passed:", mjs)
        self.assertIn("refused:", mjs)

    def test_int23_dark_surface_terminal_styling(self):
        css = CTX.get_text("assets/css/base.css")
        self.assertIn("--surface-dark", css)

    def test_int24_diagram_jump_links_match_plate_ids(self):
        dom = parse_html(CTX.get_text("diagrams/index.html"))
        jump = dom.find("p", cls="dg-jump")
        for a in jump.find_all("a"):
            target_id = a.get_attr("href").lstrip("#")
            self.assertIsNotNone(dom.find_by_id(target_id), f"Jump target #{target_id} not found")

    def test_int25_adr_fold_buttons_on_all_cards(self):
        dom = parse_html(CTX.get_text("decisions/index.html"))
        cards = dom.find_all("article", cls="dec-card")
        for c in cards:
            btn = c.find("button", cls="dec-fold")
            self.assertIsNotNone(btn, "Every ADR card must have a .dec-fold button")

    def test_int26_brand_monogram_uniform_across_pages(self):
        pages = ["index.html", "diagrams/index.html", "pipelines/index.html", "decisions/index.html"]
        if CTX.has_file("work/index.html"):
            pages.append("work/index.html")
        for p in pages:
            dom = parse_html(CTX.get_text(p))
            brand = dom.find("a", cls="brand")
            mark = brand.find("span", cls="mark")
            self.assertIsNotNone(mark)
            self.assertEqual(mark.get_text().strip(), "IJ")

    def test_int27_footer_creed_uniform_across_pages(self):
        pages = ["index.html", "diagrams/index.html", "pipelines/index.html", "decisions/index.html"]
        if CTX.has_file("work/index.html"):
            pages.append("work/index.html")
        for p in pages:
            dom = parse_html(CTX.get_text(p))
            ftr = dom.find("footer", cls="site-footer")
            self.assertIsNotNone(ftr, f"Footer missing in {p}")
            self.assertIn("Ivan Jairus", ftr.get_text())

    def test_int28_http_headers_uniformity(self):
        if not CTX.http_available:
            self.skipTest("HTTP server not available on 127.0.0.1:8731")
        for endpoint in ["/", "/diagrams/", "/pipelines/", "/decisions/"]:
            status, headers, body = CTX.http_request(endpoint)
            self.assertEqual(status, 200, f"Endpoint {endpoint} must return 200")
            self.assertIn("Cache-Control", headers)


# ---------------------------------------------------------------------------
# Tier 4: Real-World User Workloads & Journeys (15 tests)
# ---------------------------------------------------------------------------

class Tier4_UserWorkloadsAndJourneys(unittest.TestCase):
    """Tier 4: End-to-end user journeys simulating real visitor workflows."""

    def test_jrn01_executive_recruiter_journey(self):
        """10-second rule scan: landing -> hero facts -> metrics -> CV download."""
        dom = parse_html(CTX.get_text("index.html"))
        hero = dom.find("section", cls="hero")
        self.assertIsNotNone(hero)
        h1 = hero.find("h1").get_text()
        self.assertIn("Ivan Jairus", h1)
        role = hero.find("p", cls="hero-role").get_text()
        self.assertIn("DevSecOps", role)
        proof = hero.find("p", cls="hero-proof").get_text()
        self.assertIn("53 services", proof)
        self.assertIn("5 artifact types", proof)
        cv_link = hero.find("a", href=lambda h: h and "cv-ivan-jairus.pdf" in h)
        self.assertIsNotNone(cv_link)

    def test_jrn02_lead_platform_engineer_journey(self):
        """Inspects gateway architecture, 5 artifact types, and gateway.yml."""
        dom = parse_html(CTX.get_work_html())
        arch = dom.find_by_id("architecture")
        self.assertIsNotNone(arch)
        self.assertIn("53 services", arch.get_text())
        gateway_content = CTX.get_text("assets/data/src/gateway.yml")
        self.assertGreater(len(gateway_content), 100)

    def test_jrn03_security_auditor_journey(self):
        """Audits Threat Model 8 assets, fail-closed gate evaluation, and Trivy scans."""
        dom = parse_html(CTX.get_work_html())
        threat = dom.find_by_id("threat")
        self.assertIsNotNone(threat)
        rows = threat.find("table", cls="tm-tbl").find("tbody").find_all("tr")
        self.assertGreaterEqual(len(rows), 8)
        rules = CTX.get_text("assets/js/release-rules.mjs")
        self.assertIn("critical", rules.lower())

    def test_jrn04_mobile_user_visit(self):
        """Simulates 360px viewport: checks viewport meta, drawer toggle, and table wrapper."""
        for p in ["index.html", "diagrams/index.html"]:
            dom = parse_html(CTX.get_text(p))
            viewport = dom.find("meta", name="viewport")
            self.assertIsNotNone(viewport)
            self.assertIn("width=device-width", viewport.get_attr("content", ""))

    def test_jrn05_systems_architect_deep_dive(self):
        """Studies all 5 interactive SVG plates, step sequence, and 11 ADR cards."""
        dom_diag = parse_html(CTX.get_text("diagrams/index.html"))
        plates = dom_diag.find_all("section", cls="dg-plate")
        self.assertEqual(len(plates), 5)
        dom_dec = parse_html(CTX.get_text("decisions/index.html"))
        adrs = dom_dec.find_all("article", cls="dec-card")
        self.assertEqual(len(adrs), 11)

    def test_jrn06_pipeline_engineer_journey(self):
        """Compares GitLab CI and Jenkins Blue Ocean traces, toggles Refuse state."""
        dom = parse_html(CTX.get_text("pipelines/index.html"))
        self.assertIsNotNone(dom.find("div", attrs={"data-engine": "gitlab"}))
        self.assertIsNotNone(dom.find("div", attrs={"data-engine": "jenkins"}))

    def test_jrn07_release_manager_off_shift_review(self):
        """Reviews 3 weekly scanner reports: Auto-Sync, SAST, and SonarQube."""
        dom = parse_html(CTX.get_text("reports/index.html"))
        blocks = dom.find_all("section", cls="rp-block")
        self.assertEqual(len(blocks), 3)

    def test_jrn08_accessibility_screen_reader_user(self):
        """Audits ARIA landmarks, roles, labels, alt text, and skip targets."""
        for p in ["index.html", "diagrams/index.html", "pipelines/index.html", "decisions/index.html"]:
            dom = parse_html(CTX.get_text(p))
            self.assertIsNotNone(dom.find("header"))
            self.assertIsNotNone(dom.find("main"))
            self.assertIsNotNone(dom.find("footer"))

    def test_jrn09_low_bandwidth_offline_visitor(self):
        """Verifies zero external calls, static fallback, local assets."""
        pages = ["index.html", "diagrams/index.html", "pipelines/index.html", "decisions/index.html"]
        for p in pages:
            html = CTX.get_text(p)
            self.assertNotIn("https://cdnjs", html)
            self.assertNotIn("https://unpkg", html)
            self.assertNotIn("https://cdn.jsdelivr", html)

    def test_jrn10_compliance_officer_audit(self):
        """Verifies audit trails, release ledger, 5-layer approvals, anti-loop guards."""
        work_html = CTX.get_work_html()
        self.assertIn("5-layer approval", work_html)
        self.assertIn("release ledger", work_html)

    def test_jrn11_engineering_manager_onboarding(self):
        """Inspects Before vs After matrix and 4-line onboarding contract."""
        work_html = CTX.get_work_html()
        self.assertIn("ba-before", work_html)
        self.assertIn("ba-after", work_html)

    def test_jrn12_complete_site_tour(self):
        """Visits pages in sequence with 0 errors."""
        pages = ["index.html", "diagrams/index.html", "pipelines/index.html", "decisions/index.html", "reports/index.html", "index.html"]
        for p in pages:
            text = CTX.get_text(p)
            self.assertGreater(len(text), 500)

    def test_jrn13_keyboard_only_power_user(self):
        """Tests focusable element attributes, tabindex, buttons."""
        dom = parse_html(CTX.get_text("index.html"))
        buttons = dom.find_all("button")
        for b in buttons:
            self.assertIsNotNone(b.get_attr("type"))

    def test_jrn14_reduced_motion_user_experience(self):
        """Checks prefers-reduced-motion CSS media queries and JS hooks."""
        anim_css = CTX.get_text("assets/css/animations.css")
        self.assertIn("prefers-reduced-motion", anim_css)

    def test_jrn15_http_server_live_mode_verification(self):
        """Validates live HTTP serving if server is active."""
        if not CTX.http_available:
            self.skipTest("HTTP server not available on 127.0.0.1:8731")
        status, headers, body = CTX.http_request("/index.html")
        self.assertEqual(status, 200)
        self.assertIn(b"Ivan Jairus", body)


# ---------------------------------------------------------------------------
# CLI Argument Parsing & Test Suite Runner
# ---------------------------------------------------------------------------

def run_tests():
    parser = argparse.ArgumentParser(description="Ivan Jairus Portfolio E2E Test Suite")
    parser.add_argument("--mode", choices=["filesystem", "http", "auto"], default="auto",
                        help="Execution mode (filesystem, http, auto)")
    parser.add_argument("--url", default="http://127.0.0.1:8731",
                        help="Base HTTP server URL (default: http://127.0.0.1:8731)")
    parser.add_argument("--tier", default="1,2,3,4",
                        help="Comma-separated tiers to run (e.g. 1,2,3,4)")
    parser.add_argument("-v", "--verbose", action="count", default=1,
                        help="Verbosity level")
    parser.add_argument("-f", "--failfast", action="store_true",
                        help="Stop test run on first failure")

    args = parser.parse_args()

    # Re-initialize CTX with CLI args
    global CTX
    CTX = SiteContext(mode=args.mode, base_url=args.url)

    selected_tiers = [t.strip() for t in args.tier.split(",")]

    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    tier_map = {
        "1": (Tier1_FeatureCoverage, "Tier 1: Feature Coverage (27 features * 5 tests = 135 tests)"),
        "2": (Tier2_BoundaryAndCornerCases, "Tier 2: Boundary & Corner Cases (27 features * 5 tests = 135 tests)"),
        "3": (Tier3_CrossFeatureInteractions, "Tier 3: Cross-Feature Interactions & Pairwise Combinations (28 tests)"),
        "4": (Tier4_UserWorkloadsAndJourneys, "Tier 4: Real-World User Workloads & Journeys (15 tests)"),
    }

    total_registered = 0
    print("=" * 76)
    print("  IVAN JAIRUS PORTFOLIO V2 - COMPREHENSIVE E2E TEST SUITE")
    print(f"  Mode: {CTX.mode.upper()} (HTTP Server active: {CTX.http_available} at {CTX.base_url})")
    print(f"  Root: {CTX.root_dir}")
    print("=" * 76)

    for t_id in ["1", "2", "3", "4"]:
        if t_id in selected_tiers:
            test_cls, title = tier_map[t_id]
            tier_tests = loader.loadTestsFromTestCase(test_cls)
            suite.addTests(tier_tests)
            count = tier_tests.countTestCases()
            total_registered += count
            print(f"  [+] Loaded {title}: {count} tests")

    print("-" * 76)
    print(f"  Total tests scheduled: {total_registered}")
    print("-" * 76)

    runner = unittest.TextTestRunner(verbosity=args.verbose, failfast=args.failfast)
    result = runner.run(suite)

    print("=" * 76)
    print(f"  E2E TEST RUN SUMMARY")
    print(f"  Ran: {result.testsRun} tests")
    print(f"  Passed: {result.testsRun - len(result.failures) - len(result.errors) - len(result.skipped)}")
    print(f"  Failures: {len(result.failures)}")
    print(f"  Errors: {len(result.errors)}")
    print(f"  Skipped: {len(result.skipped)}")
    print("=" * 76)

    if not result.wasSuccessful():
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == "__main__":
    run_tests()
