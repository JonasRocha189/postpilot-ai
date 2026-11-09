"""Reciprocal Rank Fusion: how the vector and full-text rankings are merged."""

import uuid

from ai.rag.search import reciprocal_rank_fusion

A, B, C, D = (uuid.uuid4() for _ in range(4))


def test_an_item_in_both_rankings_beats_one_in_a_single_ranking() -> None:
    # B is 2nd in both; A is 1st in only one
    merged = reciprocal_rank_fusion([A, B], [C, B])
    assert merged[0][0] == B


def test_scores_follow_the_formula() -> None:
    merged = dict(reciprocal_rank_fusion([A, B], [B], k=60))
    assert merged[A] == 1 / 61
    assert merged[B] == 1 / 62 + 1 / 61


def test_the_order_is_by_score_and_keeps_every_item() -> None:
    merged = reciprocal_rank_fusion([A, B, C], [D])
    assert [item for item, _ in merged][:1] in ([A], [D])
    assert {item for item, _ in merged} == {A, B, C, D}
    scores = [score for _, score in merged]
    assert scores == sorted(scores, reverse=True)


def test_no_rankings_no_results() -> None:
    assert reciprocal_rank_fusion([], []) == []
