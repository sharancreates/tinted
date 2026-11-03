"""Tests for product photo candidate scoring.

The failure this guards against is specific and was seen in production: a
recommendation card for a Maybelline foundation showing a photo of Halloween
nail art. Image search matches the words, and beauty product names appear all
over user-generated content worn *with* the product rather than showing it.
"""

import pytest

from api.product_images import _MIN_SCORE, _score_candidate, cache_key

BRAND = "Maybelline"
PRODUCT = "Fit Me Liquid Foundation"


def score(url: str, title: str, brand: str = BRAND, product: str = PRODUCT) -> int:
    return _score_candidate({"image": url, "title": title}, brand, product)


def accepted(url: str, title: str, **kw) -> bool:
    return score(url, title, **kw) >= _MIN_SCORE


# ── Rejections ────────────────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "host",
    [
        "https://i.pinimg.com/orig/x.jpg",
        "https://scontent.cdninstagram.com/x.jpg",
        "https://p16.tiktokcdn.com/x.jpg",
        "https://64.media.tumblr.com/x.jpg",
        "https://1.bp.blogspot.com/x.jpg",
        "https://preview.redd.it/x.jpg",
        "https://pbs.twimg.com/x.jpg",
    ],
)
def test_user_generated_hosts_are_rejected(host):
    """Even with a perfectly matching title — this is the nail-art case."""
    assert not accepted(host, "Maybelline Fit Me Liquid Foundation")


@pytest.mark.parametrize(
    "title",
    [
        "Halloween nail art using Maybelline Fit Me",
        "Maybelline Fit Me foundation manicure tutorial",
        "Maybelline Fit Me Foundation aesthetic wallpaper",
        "Maybelline Fit Me dupe vs NARS",
    ],
)
def test_look_and_content_titles_are_rejected(title):
    assert not accepted("https://i5.walmartimages.com/x.jpg", title)


def test_trusted_host_cannot_rescue_an_irrelevant_result():
    """Host reputation is a tie-breaker, never a substitute for relevance."""
    assert not accepted("https://cdn.shopify.com/x.jpg", "Random lipstick")


def test_non_https_is_rejected():
    assert not accepted(
        "http://shop.example.com/x.jpg", "Maybelline Fit Me Liquid Foundation"
    )


def test_empty_title_is_rejected():
    assert not accepted("https://media.ulta.com/x.jpg", "")


def test_malformed_url_is_rejected():
    assert not accepted("not-a-url", "Maybelline Fit Me Liquid Foundation")


# ── Acceptances ───────────────────────────────────────────────────────────────

def test_retailer_listing_is_accepted():
    assert accepted(
        "https://i5.walmartimages.com/seo/x.jpg",
        "Maybelline Fit Me Matte + Poreless Liquid Foundation, 220 Natural Beige",
    )


def test_unknown_shop_wins_on_relevance_alone():
    """An unrecognised but legitimate retailer must still be usable."""
    assert accepted(
        "https://vegascosmetics.pk/x.jpg",
        "Maybelline - Fit Me Liquid Foundation Matte & Poreless",
    )


def test_title_without_brand_still_passes_on_product_words():
    assert accepted(
        "https://media.ulta.com/x.jpg",
        "Fit Me Matte + Poreless Liquid Foundation",
    )


# ── Ranking ───────────────────────────────────────────────────────────────────

def test_preferred_host_outranks_equally_relevant_unknown_host():
    title = "Maybelline Fit Me Liquid Foundation"
    assert score("https://media.ulta.com/x.jpg", title) > score(
        "https://randomshop.example/x.jpg", title
    )


def test_more_matching_words_outrank_fewer():
    strong = score("https://media.ulta.com/x.jpg", "Maybelline Fit Me Liquid Foundation")
    weak = score("https://media.ulta.com/x.jpg", "Maybelline mascara")
    assert strong > weak


def test_brand_match_outweighs_a_single_product_word():
    brand_only = score("https://shop.example/x.jpg", "Maybelline cosmetics")
    word_only = score("https://shop.example/x.jpg", "liquid something")
    assert brand_only > word_only


# ── Cache key ─────────────────────────────────────────────────────────────────

def test_cache_key_is_case_and_whitespace_insensitive():
    assert cache_key("  NARS ", "Sheer Glow") == cache_key("nars", "sheer glow")


def test_cache_key_separates_distinct_products():
    assert cache_key("NARS", "Sheer Glow") != cache_key("NARS", "Light Reflecting")


# ── Seen in production: wrong photo for a real product ────────────────────────

def test_shade_chart_sharing_a_brand_word_is_rejected():
    """Black Opal True Color was shown as a '100+ shades of black' chart."""
    assert not accepted(
        "https://shop.example/x.jpg",
        "100+ Shades of Black colour chart",
        brand="Black Opal",
        product="True Color Flawless Liquid Foundation",
    )


def test_one_brand_word_is_not_a_brand_match():
    """Only the whole distinctive brand counts, so 'black' alone earns nothing."""
    partial = score("https://shop.example/x.jpg", "Black liquid", brand="Black Opal",
                    product="True Color Flawless Liquid Foundation")
    full = score("https://shop.example/x.jpg", "Black Opal liquid", brand="Black Opal",
                 product="True Color Flawless Liquid Foundation")
    assert full > partial


def test_generic_brand_words_are_not_required():
    assert accepted(
        "https://media.ulta.com/x.jpg",
        "Fenty Pro Filt'r Soft Matte Longwear Foundation",
        brand="Fenty Beauty",
        product="Pro Filt'r Soft Matte Longwear Foundation",
    )


def test_punctuated_brand_matches():
    assert accepted(
        "https://shop.example/x.jpg",
        "M·A·C Face and Body Foundation 120ml",
        brand="MAC",
        product="Face and Body Foundation",
    )


def test_a_different_product_type_is_rejected():
    assert not accepted("https://media.ulta.com/x.jpg", "Maybelline Fit Me Mascara")


def test_wide_banner_is_rejected_when_size_is_known():
    image = {"image": "https://media.ulta.com/x.jpg",
             "title": "Maybelline Fit Me Liquid Foundation", "width": 1600, "height": 500}
    assert _score_candidate(image, BRAND, PRODUCT) < _MIN_SCORE


def test_portrait_product_shot_is_accepted_when_size_is_known():
    image = {"image": "https://media.ulta.com/x.jpg",
             "title": "Maybelline Fit Me Liquid Foundation", "width": 800, "height": 1000}
    assert _score_candidate(image, BRAND, PRODUCT) >= _MIN_SCORE
