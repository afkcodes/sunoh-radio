"""Parity test for the canonical Python URL normalizer.

Asserts against the SAME fixture used by tests/normalizeUrl.test.ts so the
Python and TypeScript implementations stay byte-for-byte compatible.
"""
import json
import os
import sys

import pytest

# Make scripts/lib importable.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from lib.normalize_url import normalize_url  # noqa: E402

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FIXTURE = os.path.join(PROJECT_ROOT, "tests", "fixtures", "url_normalization.json")

with open(FIXTURE, encoding="utf-8") as f:
    CASES = json.load(f)


@pytest.mark.parametrize("case", CASES, ids=[c["input"] or "<empty>" for c in CASES])
def test_normalize_url_matches_fixture(case):
    assert normalize_url(case["input"]) == case["expected"]


def test_empty_and_none():
    assert normalize_url("") == ""
    assert normalize_url(None) == ""
