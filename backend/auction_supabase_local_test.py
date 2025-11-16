from __future__ import annotations

import json
from typing import Dict, Any, List

from multi_round_auction import run_multi_round_auction
from auction_core import Profile


# ---------- Load fake "DB" ----------

def load_fake_db(path: str = "fake_supabase_data.json") -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_base_config(path: str = "auction_config.json") -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# ---------- Helpers that mirror the Supabase adapter ----------

def get_fake_auction(fake_db: Dict[str, Any], auction_id: str) -> Dict[str, Any]:
    for row in fake_db.get("auction", []):
        if row["auction_id"] == auction_id:
            return row
    raise ValueError(f"auction_id={auction_id} not found in fake DB")


def get_fake_bids(fake_db: Dict[str, Any], auction_id: str) -> List[Dict[str, Any]]:
    return [b for b in fake_db.get("bid", []) if b["auction_id"] == auction_id]


def get_fake_users(fake_db: Dict[str, Any], user_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    users = {}
    for row in fake_db.get("user", []):
        if row["user_id"] in user_ids:
            users[row["user_id"]] = row
    return users


def build_config_from_fake_db(
    auction_id: str,
    buyer_user_id: str,
    num_rounds: int,
    base_config_path: str = "auction_config.json",
    fake_db_path: str = "fake_supabase_data.json",
) -> Dict[str, Any]:
    """
    This mirrors build_config_from_supabase(), but uses fake_supabase_data.json
    instead of hitting a real database.
    """
    base_cfg = load_base_config(base_config_path)
    fake_db = load_fake_db(fake_db_path)

    auction_row = get_fake_auction(fake_db, auction_id)
    bids = get_fake_bids(fake_db, auction_id)

    user_ids = [b["user_id"] for b in bids]
    users_by_id = get_fake_users(fake_db, user_ids)

    if buyer_user_id not in users_by_id:
        raise ValueError(f"buyer_user_id={buyer_user_id} is not a bidder in this auction.")

    buyer_row = users_by_id[buyer_user_id]

    # ----- weights -----
    donation_weight = float(auction_row.get("donation_weight", 1.0) or 1.0)
    profile_weight = float(auction_row.get("profile_weight", 1.0) or 1.0)
    fairness_weight = float(auction_row.get("fairness_weight", 0.0) or 0.0)

    total_w = donation_weight + profile_weight + fairness_weight
    if total_w <= 0:
        total_w = 1.0

    money_weight = donation_weight / total_w
    social_weight = (profile_weight + fairness_weight) / total_w

    # ----- buyer min/max -----
    track_min_bid = float(auction_row.get("min_donation", 0.0) or 0.0)
    user_max_bid = float(buyer_row.get("donation", 0.0) or 0.0)
    buyer_name = buyer_row.get("name", "Unknown Buyer")

    impact_area = auction_row.get("impact_area") or "general impact"

    # ----- build agents -----
    agents: List[Profile] = []
    for b in bids:
        uid = b["user_id"]
        u = users_by_id.get(uid)
        if not u:
            continue

        start_bid = float(b.get("bid_amount", 0.0) or 0.0)
        max_bid = float(u.get("donation", start_bid) or start_bid)

        affiliation = u.get("affiliation") or ""
        strategy = u.get("strategy") or "balanced"

        philanthropy_score = u.get("philantrophy_score") or u.get("philanthropy_score") or 0
        socialimpact_score = u.get("socialimpact_score") or 0

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
            "country": "",
            "profession": affiliation,
            "social_contribution": social_contribution,
            "strategy": strategy,
            "start_bid": start_bid,
            "max_bid": max_bid,
        }

        agents.append(profile)

    if not agents:
        raise ValueError(f"No bids found for auction_id={auction_id} in fake DB")

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
        "strategy_params": base_cfg["strategy_params"],
        "gemini": base_cfg.get("gemini", {"enabled": True, "model": "gemini-2.5-flash"}),
        "agents": agents,
        "rag_docs": base_cfg.get("rag_docs", []),
    }

    return config


# ---------- CLI test ----------

if __name__ == "__main__":
    # Match IDs from fake_supabase_data.json
    auction_id = "auction_1"
    buyer_user_id = "user_adrian"
    num_rounds = 3

    cfg = build_config_from_fake_db(
        auction_id=auction_id,
        buyer_user_id=buyer_user_id,
        num_rounds=num_rounds,
        base_config_path="auction_config.json",
        fake_db_path="fake_supabase_data.json",
    )

    result = run_multi_round_auction(cfg)
    data = result.to_dict()

    print("Social mode used:", data["social_mode"])
    print("====== Multi-round auction summary (FAKE DB) ======\n")

    for round_info in data["rounds"]:
        print(f"--- Round {round_info['round_index']} ---")
        w = round_info["winner"]
        print(
            f"Winner: {w['name']} "
            f"(final={w['final_score']}, money={w['money_score']}, "
            f"social={w['social_score']}, bid={w['bid']})"
        )
        print("Ranking:")
        for e in round_info["ranking"]:
            print(
                f"  {e['name']}: final={e['final_score']}, "
                f"money={e['money_score']}, social={e['social_score']}, "
                f"bid={e['bid']}"
            )
        print()

    fw = data["final_winner"]
    print("====== Final winner (FAKE DB) ======")
    print(
        f"{fw['name']} "
        f"(final={fw['final_score']}, money={fw['money_score']}, "
        f"social={fw['social_score']}, bid={fw['bid']})"
    )
    print("Reason:", fw["social_reason"])
