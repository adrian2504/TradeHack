# export_auction_result_for_edge.py

from __future__ import annotations

import json
from typing import Dict, Any

from multi_round_auction import run_multi_round_auction, load_config


def main() -> None:
    # 1) Load config
    config: Dict[str, Any] = load_config("auction_config.json")

    # 2) Run multi-round auction
    result = run_multi_round_auction(config)

    # 3) Convert to dict
    data = result.to_dict()

    # 4) Save to JSON
    output_path = "edge_input.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    print(f"[EXPORT] Saved auction result to {output_path}")
    print(f"[EXPORT] Social mode: {data['social_mode']}")
    fw = data["final_winner"]
    print(
        f"[EXPORT] Final winner: {fw['name']} "
        f"(final={fw['final_score']}, money={fw['money_score']}, "
        f"social={fw['social_score']}, bid={fw['bid']})"
    )


if __name__ == "__main__":
    main()
