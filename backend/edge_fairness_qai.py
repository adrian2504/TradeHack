# edge_fairness_qai.py

from __future__ import annotations

import json
from typing import Dict, Any, List, Tuple

import numpy as np


def load_edge_input(path: str = "edge_input.json") -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def extract_final_ranking(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    rounds = data.get("rounds", [])
    if not rounds:
        raise ValueError("No rounds found in edge_input.json")

    final_round = rounds[-1]
    ranking = final_round.get("ranking", [])
    if not ranking:
        raise ValueError("No ranking found in final round")

    return ranking


def build_feature_matrix(ranking: List[Dict[str, Any]]) -> Tuple[np.ndarray, List[str]]:
    names: List[str] = []
    rows: List[List[float]] = []

    for entry in ranking:
        name = entry.get("name", "Unknown")
        money = float(entry.get("money_score", 0.0))
        social = float(entry.get("social_score", 0.0))
        final = float(entry.get("final_score", 0.0))

        names.append(name)
        rows.append([money, social, final])

    features = np.asarray(rows, dtype=np.float32)
    return features, names


def _predict_fairness_with_edge_model(features: np.ndarray) -> np.ndarray:
    """
    Placeholder for a real Qualcomm Edge AI call.
    For now, fairness = 0.8 * social_score + 0.2 * final_score.
    """
    if features.size == 0:
        return np.zeros((0,), dtype=np.float32)

    social = features[:, 1]
    final = features[:, 2]

    raw = 0.8 * social + 0.2 * final
    fairness = np.clip(raw, 0.0, 1.0)
    return fairness

    # When you’re ready to plug QAI Hub in, replace the above block with:
    #
    # from qai_hub import Client
    # import os
    #
    # api_key = os.getenv("QAI_HUB_API_KEY")
    # project_id = os.getenv("QAI_HUB_PROJECT_ID")
    # model_id = os.getenv("QAI_HUB_MODEL_ID")
    #
    # client = Client(api_key=api_key, project_id=project_id)
    # job = client.infer(
    #     model_id=model_id,
    #     inputs={"input": features},
    # )
    # outputs = job.get_outputs()
    # fairness = outputs["fairness"].numpy().reshape(-1)
    # return np.clip(fairness, 0.0, 1.0)


def compute_edge_fairness_scores(
    ranking: List[Dict[str, Any]]
) -> List[Tuple[str, float]]:
    features, names = build_feature_matrix(ranking)
    fairness = _predict_fairness_with_edge_model(features)
    return list(zip(names, fairness.tolist()))


def main() -> None:
    # 1) Load the JSON produced by export_auction_result_for_edge.py
    data = load_edge_input("edge_input.json")

    # 2) Extract final ranking
    ranking = extract_final_ranking(data)

    # 3) Compute edge fairness scores (heuristic for now)
    fairness_list = compute_edge_fairness_scores(ranking)

    # 4) Print a nice little report
    print("====== Edge AI Fairness Report (Prototype) ======")
    print(f"Social mode used by auction core: {data.get('social_mode', 'unknown')}")
    print()

    for (name, fairness), entry in zip(fairness_list, ranking):
        money = entry.get("money_score", 0.0)
        social = entry.get("social_score", 0.0)
        final = entry.get("final_score", 0.0)

        # profile is optional; handle gracefully
        profile = entry.get("profile", {}) or {}
        bid = profile.get("max_bid", "N/A")

        print(
            f"{name}:\n"
            f"  bid={bid}, money_score={money}, social_score={social}, final_score={final}\n"
            f"  edge_fairness_score={round(fairness, 3)}"
        )
        print()

    # 5) Optionally, save to JSON for later use or dashboarding
    out = [
        {
            "name": name,
            "edge_fairness_score": fairness,
        }
        for name, fairness in fairness_list
    ]
    with open("edge_fairness_output.json", "w", encoding="utf-8") as f:
        json.dump({"scores": out}, f, indent=2)
    print("[EDGE] Saved fairness scores to edge_fairness_output.json")


if __name__ == "__main__":
    main()
