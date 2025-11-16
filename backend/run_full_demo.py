# run_full_demo.py

from __future__ import annotations

import json

from multi_round_auction import run_multi_round_auction, load_config
from edge_fairness_qai import (
    load_edge_input,
    extract_final_ranking,
    compute_edge_fairness_scores,
)


def main() -> None:
    # 1) Run the multi-round auction
    config = load_config("auction_config.json")
    result = run_multi_round_auction(config)
    data = result.to_dict()

    print("=== Step 1: Multi-round AI Auction (Server + Gemini) ===")
    print(f"Social mode used: {data['social_mode']}")
    print()

    for round_info in data["rounds"]:
        print(f"--- Round {round_info['round_index']} ---")
        w = round_info["winner"]
        print(
            f"Winner: {w['name']} "
            f"(final={w['final_score']}, money={w['money_score']}, "
            f"social={w['social_score']}, bid={w['bid']})"
        )
    print()

    fw = data["final_winner"]
    print("Final winner:")
    print(
        f"  {fw['name']} "
        f"(final={fw['final_score']}, money={fw['money_score']}, "
        f"social={fw['social_score']}, bid={fw['bid']})"
    )
    print("Reason:", fw["social_reason"])
    print()

    # 2) Save to edge_input.json (same as export script)
    with open("edge_input.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print("[DEMO] Saved auction result to edge_input.json")
    print()

    # 3) Run the edge fairness analysis (sidecar)
    print("=== Step 2: Edge AI Fairness Predictor (Prototype) ===")
    edge_data = load_edge_input("edge_input.json")
    ranking = extract_final_ranking(edge_data)
    fairness_list = compute_edge_fairness_scores(ranking)

    for (name, fairness), entry in zip(fairness_list, ranking):
        money = entry.get("money_score", 0.0)
        social = entry.get("social_score", 0.0)
        final = entry.get("final_score", 0.0)
        profile = entry.get("profile", {}) or {}
        bid = profile.get("max_bid", "N/A")

        print(
            f"{name}:\n"
            f"  bid={bid}, money_score={money}, social_score={social}, final_score={final}\n"
            f"  edge_fairness_score={round(fairness, 3)}"
        )
        print()

    print("=== End of demo ===")


if __name__ == "__main__":
    main()
