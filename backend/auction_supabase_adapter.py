from __future__ import annotations

import os
import json
from typing import Dict, Any, List, Optional

from supabase import create_client, Client

from multi_round_auction import run_multi_round_auction, MultiRoundAuctionResult
from auction_core import Profile

# Supabase client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get(
    "SUPABASE_ANON_KEY"
)

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/ANON_KEY not set.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def load_base_config(path: str = "auction_config.json") -> Dict[str, Any]:
    """
    JSON still holds:
      - strategy_params (greedy / cautious / balanced tuning)
      - gemini config (enabled + model name)
      - rag_docs (persona text)
    Auction params + agents will be overridden from Supabase.
    """
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

# Supabase fetch helpers

def fetch_auction_row(auction_id: str) -> Dict[str, Any]:
    resp = (
        supabase.table("auction")
        .select("*")
        .eq("auction_id", auction_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise ValueError(f"auction_id={auction_id} not found")
    return resp.data


def fetch_bids_for_auction(auction_id: str) -> List[Dict[str, Any]]:
    resp = (
        supabase.table("bid")
        .select("*")
        .eq("auction_id", auction_id)
        .execute()
    )
    return resp.data or []


def fetch_users_by_ids(user_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    if not user_ids:
        return {}
    resp = (
        supabase.table("user")
        .select("*")
        .in_("user_id", user_ids)
        .execute()
    )
    rows = resp.data or []
    return {row["user_id"]: row for row in rows}

# Build model config from Supabase

def build_config_from_supabase(
    auction_id: str,
    buyer_user_id: str,
    num_rounds: int,
    base_config_path: str = "auction_config.json",
) -> Dict[str, Any]:
    """
    Build the config dict expected by run_multi_round_auction()
    using:
      - auction table: weights, min_donation, impact_area, etc.
      - bid table: bid_amount per user per auction
      - user table: name, affiliation (strategy), donation, existing scores.

    buyer_user_id: which user is the "buyer agent" (your own agent).
    """
    base_cfg = load_base_config(base_config_path)

    auction_row = fetch_auction_row(auction_id)
    bids = fetch_bids_for_auction(auction_id)

    user_ids = [b["user_id"] for b in bids]
    users_by_id = fetch_users_by_ids(user_ids)

    if buyer_user_id not in users_by_id:
        raise ValueError(f"buyer_user_id={buyer_user_id} is not a bidder in this auction.")

    buyer_row = users_by_id[buyer_user_id]

    # weights: donation vs profile+fairness mapped to money/social
    donation_weight = float(auction_row.get("donation_weight", 1.0) or 1.0)
    profile_weight = float(auction_row.get("profile_weight", 1.0) or 1.0)
    fairness_weight = float(auction_row.get("fairness_weight", 0.0) or 0.0)

    total_w = donation_weight + profile_weight + fairness_weight
    if total_w <= 0:
        total_w = 1.0

    money_weight = donation_weight / total_w
    social_weight = (profile_weight + fairness_weight) / total_w

    # min from auction, max from user
    track_min_bid = float(auction_row.get("min_donation", 0.0) or 0.0)
    user_max_bid = float(buyer_row.get("donation", 0.0) or 0.0)

    buyer_name = buyer_row.get("name", "Unknown Buyer")

    #  build agents list from bids
    agents: List[Profile] = []
    impact_area = auction_row.get("impact_area") or "general impact"

    for b in bids:
        uid = b["user_id"]
        u = users_by_id.get(uid)
        if not u:
            # Skip bids with missing users
            continue

        # Use bid_amount as starting bid; donation column as max willingness
        start_bid = float(b.get("bid_amount", 0.0) or 0.0)
        max_bid = float(u.get("donation", start_bid) or start_bid)

        # Affiliation ~ profession in our model
        affiliation = u.get("affiliation") or ""
        strategy = u.get("strategy") or "balanced"

        philanthropy_score = u.get("philantrophy_score") or u.get("philanthropy_score") or 0
        socialimpact_score = u.get("socialimpact_score") or 0

        # Build a synthetic social_contribution text using scores + impact area.
        social_contribution = (
            f"This donor is affiliated with {affiliation or 'no specified organization'} "
            f"and participates in auctions focused on {impact_area}. "
            f"They have philanthropy_score={philanthropy_score} and "
            f"socialimpact_score={socialimpact_score} recorded in the system."
        )

        profile: Profile = {
            "user_id": uid,
            "name": u.get("name", "Unknown"),
            "email": u.get("email", ""),
            "country": "",  # extend your schema later if you want country
            "profession": affiliation,
            "social_contribution": social_contribution,
            "strategy": strategy,
            "start_bid": start_bid,
            "max_bid": max_bid,
        }

        agents.append(profile)

    if not agents:
        raise ValueError(f"No bids found for auction_id={auction_id}")

    # ------ build config dict for the model ------
    config: Dict[str, Any] = {
        "auction_params": {
            "buyer_name": buyer_name,
            "track_min_bid": track_min_bid,
            "user_max_bid": user_max_bid,
            "num_rounds": num_rounds,
            "money_weight": money_weight,
            "social_weight": social_weight,
            "random_seed": base_cfg.get("auction_params", {}).get("random_seed", 42),
        },
        "strategy_params": base_cfg["strategy_params"],  # comes from JSON
        "gemini": base_cfg.get("gemini", {"enabled": True, "model": "gemini-2.5-flash"}),
        "agents": agents,
        "rag_docs": base_cfg.get("rag_docs", []),
    }

    return config

# Write-back: update user table with scores from the model


def update_user_scores_from_result(
    auction_id: str, result: MultiRoundAuctionResult
) -> None:
    """
    Take the final round ranking from the model and write scores back into
    the user table:

      - philanthropy_score   (int)
      - socialimpact_score   (int)
      - fairness_score       (numeric)
      - composite_score      (numeric)

    Assumes each profile in ranking has 'user_id'.
    """
    # Use the last round's ranking as the final scores
    final_round = result.rounds[-1]
    ranking = final_round.ranking

    for entry in ranking:
        profile = entry["profile"]
        user_id = profile.get("user_id")
        if not user_id:
            continue

        money_score = float(entry["money_score"])
        social_score = float(entry["social_score"])
        final_score = float(entry["final_score"])

        philanthropy_score = int(round(money_score * 100))
        socialimpact_score = int(round(social_score * 100))
        fairness_score = social_score  # you can change this formula later
        composite_score = final_score

        supabase.table("user").update(
            {
                "philantrophy_score": philanthropy_score,
                "socialimpact_score": socialimpact_score,
                "fairness_score": fairness_score,
                "composite_score": composite_score,
            }
        ).eq("user_id", user_id).execute()

# Convenience: run + persist for a single auction

def run_auction_from_supabase(
    auction_id: str,
    buyer_user_id: str,
    num_rounds: int = 3,
    base_config_path: str = "auction_config.json",
) -> MultiRoundAuctionResult:
    """
    High-level helper:

      1) Read auction + bids + users from Supabase
      2) Build config dict for the model
      3) Run multi-round auction
      4) Write scores back to user table
      5) Return the result object
    """
    cfg = build_config_from_supabase(
        auction_id=auction_id,
        buyer_user_id=buyer_user_id,
        num_rounds=num_rounds,
        base_config_path=base_config_path,
    )

    result = run_multi_round_auction(cfg)

    # Persist outputs into user table
    update_user_scores_from_result(auction_id, result)

    return result

# CLI


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 3:
        print("Usage: python auction_supabase_adapter.py <auction_id> <buyer_user_id>")
        raise SystemExit(1)

    auction_id = sys.argv[1]
    buyer_user_id = sys.argv[2]

    res = run_auction_from_supabase(auction_id, buyer_user_id, num_rounds=3)
    data = res.to_dict()

    print("Social mode used:", data["social_mode"])
    print("Final winner:", data["final_winner"])
