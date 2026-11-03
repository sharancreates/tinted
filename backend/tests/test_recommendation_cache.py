"""Recommendation caching and in-flight sharing (no network: generation is stubbed)."""

import threading
import time

import pytest

import api.claude_recommendations as recs


def _complete() -> dict:
    return {name: [{"brand": "B", "product": "P"}] for name, _, _ in recs.CATEGORIES}


@pytest.fixture(autouse=True)
def _clear_cache():
    recs._cache.clear()
    recs._inflight.clear()
    yield
    recs._cache.clear()
    recs._inflight.clear()


def test_second_request_for_same_tone_is_served_from_cache(monkeypatch):
    calls = []
    monkeypatch.setattr(recs, "_generate_all", lambda *a: calls.append(a) or _complete())
    first = recs.get_full_beauty_recommendations("MST-6", "neutral", "#ca8263", "all")
    second = recs.get_full_beauty_recommendations("MST-6", "Neutral", "#000000", "all")
    assert first == second
    assert len(calls) == 1


def test_measured_hex_does_not_split_the_cache(monkeypatch):
    calls = []
    monkeypatch.setattr(recs, "_generate_all", lambda *a: calls.append(a) or _complete())
    recs.get_full_beauty_recommendations("MST-3", "warm", "#f0d0b0", "mid")
    recs.get_full_beauty_recommendations("MST-3", "warm", "#e8c8a8", "mid")
    assert len(calls) == 1


def test_different_budget_is_a_different_entry(monkeypatch):
    calls = []
    monkeypatch.setattr(recs, "_generate_all", lambda *a: calls.append(a) or _complete())
    recs.get_full_beauty_recommendations("MST-3", "warm", budget="mid")
    recs.get_full_beauty_recommendations("MST-3", "warm", budget="high")
    assert len(calls) == 2


def test_partial_result_is_returned_but_not_cached(monkeypatch):
    partial = _complete()
    partial["lip"] = []
    calls = []
    monkeypatch.setattr(recs, "_generate_all", lambda *a: calls.append(a) or partial)
    assert recs.get_full_beauty_recommendations("MST-9", "cool")["lip"] == []
    recs.get_full_beauty_recommendations("MST-9", "cool")
    assert len(calls) == 2


def test_concurrent_requests_share_one_generation(monkeypatch):
    calls = []

    def slow(*a):
        calls.append(a)
        time.sleep(0.2)
        return _complete()

    monkeypatch.setattr(recs, "_generate_all", slow)
    results = []
    threads = [
        threading.Thread(target=lambda: results.append(recs.get_full_beauty_recommendations("MST-5", "warm")))
        for _ in range(4)
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert len(calls) == 1
    assert len(results) == 4 and all(r == results[0] for r in results)


def test_generation_failure_returns_empty_and_is_not_cached(monkeypatch):
    def boom(*a):
        raise RuntimeError("upstream down")

    monkeypatch.setattr(recs, "_generate_all", boom)
    assert recs.get_full_beauty_recommendations("MST-2", "cool") == {}
    assert not recs._cache


def test_groups_cover_every_category_exactly_once():
    names = [n for group in recs.GROUPS for n in group]
    assert sorted(names) == sorted(n for n, _, _ in recs.CATEGORIES)
