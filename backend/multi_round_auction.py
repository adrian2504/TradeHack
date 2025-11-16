# multi_round_auction.py

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional

from auction_core import rank_profiles, Profile  # import from the other file

# Config loading + RAG index

def load_config(path: str = "auction_config.json") -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def build_rag_index(config: Dict[str, Any]) -> Dict[str, List[str]]:
    index: Dict[str, List[str]] = {}
    for doc in config.get("rag_docs", []):
        name = doc.get("name")
        text = (doc.get("text") or "").strip()
        if not name or not text:
            continue
        index.setdefault(name, []).append(text)
    return index


# Agent + Auction data structures

@dataclass
class Agent:
    name: str
    base_profile: Profile
    current_bid: float
    true_max_bid: float
    strategy: str
    strategy_params: Dict[str, Any]
    history: List[Dict[str, Any]] = field(default_factory=list)

    def decide_raise(
        self,
        round_index: int,
        total_rounds: int,
        last_ranking: Optional[List[Dict[str, Any]]],
    ) -> None:
        # Determine position from last ranking: 0 = best
        position = None
        if last_ranking is not None:
            for idx, entry in enumerate(last_ranking):
                if entry["name"] == self.name:
                    position = idx
                    break

        if position is None and last_ranking is not None:
            position = len(last_ranking) // 2
        elif position is None:
            position = 0

        num_agents = len(last_ranking) if last_ranking else 1
        if num_agents > 1:
            loser_factor = position / (num_agents - 1)
        else:
            loser_factor = 0.0

        remaining = max(0.0, self.true_max_bid - self.current_bid)
        if remaining <= 0:
            self.history.append(
                {
                    "round": round_index,
                    "action": "no_raise",
                    "reason": "reached true_max_bid",
                    "current_bid": self.current_bid,
                }
            )
            return

        rounds_left = max(1, total_rounds - round_index)

        base_fraction = float(self.strategy_params["base_fraction"])
        rand_min = float(self.strategy_params["rand_min"])
        rand_max = float(self.strategy_params["rand_max"])
        loser_factor_min = float(self.strategy_params["loser_factor_min"])
        loser_factor_max = float(self.strategy_params["loser_factor_max"])

        loser_influence = loser_factor_min + (loser_factor_max - loser_factor_min) * loser_factor

        import random
        raise_fraction = base_fraction * loser_influence
        noise = random.uniform(rand_min, rand_max)
        raise_fraction *= noise

        planned_raise = remaining * raise_fraction
        planned_raise = min(planned_raise, remaining / rounds_left)

        new_bid = self.current_bid + planned_raise
        if new_bid > self.true_max_bid:
            new_bid = self.true_max_bid

        new_bid = round(new_bid, 2)

        self.history.append(
            {
                "round": round_index,
                "position": position,
                "loser_factor": round(loser_factor, 3),
                "remaining_before": round(remaining, 2),
                "planned_raise": round(planned_raise, 2),
                "new_bid": new_bid,
                "strategy": self.strategy,
            }
        )
        self.current_bid = new_bid


@dataclass
class AuctionRoundResult:
    round_index: int
    ranking: List[Dict[str, Any]]
    winner: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "round_index": self.round_index,
            "ranking": [
                {
                    "name": e["name"],
                    "final_score": e["final_score"],
                    "money_score": e["money_score"],
                    "social_score": e["social_score"],
                    "bid": e["profile"]["max_bid"],
                    "social_reason": e["social_reason"],
                }
                for e in self.ranking
            ],
            "winner": {
                "name": self.winner["name"],
                "final_score": self.winner["final_score"],
                "money_score": self.winner["money_score"],
                "social_score": self.winner["social_score"],
                "bid": self.winner["profile"]["max_bid"],
                "social_reason": self.winner["social_reason"],
            },
        }


@dataclass
class MultiRoundAuctionResult:
    rounds: List[AuctionRoundResult]
    final_winner: Dict[str, Any]
    social_mode: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "social_mode": self.social_mode,
            "final_winner": self.final_winner,
            "rounds": [r.to_dict() for r in self.rounds],
        }

# Agent preparation

def prepare_agents_from_config(config: Dict[str, Any]) -> List[Agent]:
    auction_params = config["auction_params"]
    buyer_name = auction_params["buyer_name"]
    track_min_bid = float(auction_params["track_min_bid"])
    user_max_bid = float(auction_params["user_max_bid"])

    strategy_params_map = config["strategy_params"]
    agents_config = config["agents"]

    agents: List[Agent] = []

    for p in agents_config:
        name = p["name"]
        strategy = p["strategy"]
        start_bid = float(p["start_bid"])
        max_bid = float(p["max_bid"])

        if name == buyer_name:
            start_bid = max(track_min_bid, start_bid)
            max_bid = max(user_max_bid, start_bid)

        if start_bid > max_bid:
            start_bid = max_bid

        agents.append(
            Agent(
                name=name,
                base_profile=p,
                current_bid=start_bid,
                true_max_bid=max_bid,
                strategy=strategy,
                strategy_params=strategy_params_map[strategy],
            )
        )

    return agents


def _round_profiles_for_agents(agents: List[Agent]) -> List[Profile]:
    """
    For the current round:
    - Copy each agent's base_profile
    - Set start_bid and max_bid equal to current_bid
      so auction_core.compute_money_scores() uses current bid.
    """
    round_profiles: List[Profile] = []
    for agent in agents:
        prof = dict(agent.base_profile)
        prof["start_bid"] = agent.current_bid
        prof["max_bid"] = agent.current_bid
        round_profiles.append(prof)
    return round_profiles

# Multi-round auction runner

def run_multi_round_auction(config: Dict[str, Any]) -> MultiRoundAuctionResult:
    auction_params = config["auction_params"]
    num_rounds = int(auction_params["num_rounds"])
    weight_money = float(auction_params["money_weight"])
    weight_social = float(auction_params["social_weight"])

    gemini_cfg = config.get("gemini", {})
    model_name = gemini_cfg.get("model", "gemini-2.5-flash")
    use_gemini_flag = bool(gemini_cfg.get("enabled", True))

    seed = auction_params.get("random_seed", None)
    if seed is not None:
        import random
        random.seed(seed)

    rag_index = build_rag_index(config)
    agents = prepare_agents_from_config(config)

    rounds: List[AuctionRoundResult] = []
    social_mode: Optional[str] = None
    final_winner: Optional[Dict[str, Any]] = None
    last_ranking: Optional[List[Dict[str, Any]]] = None

    for r in range(1, num_rounds + 1):
        round_profiles = _round_profiles_for_agents(agents)

        result = rank_profiles(
            round_profiles,
            use_gemini=use_gemini_flag,
            rag_index=rag_index,
            weight_social=weight_social,
            weight_money=weight_money,
            model_name=model_name,
        )

        if social_mode is None:
            social_mode = result["social_mode"]

        round_ranking = result["ranking"]
        round_winner = result["winner"]

        rounds.append(
            AuctionRoundResult(
                round_index=r,
                ranking=round_ranking,
                winner=round_winner,
            )
        )
        final_winner = round_winner
        last_ranking = round_ranking

        if r < num_rounds:
            for agent in agents:
                agent.decide_raise(
                    round_index=r,
                    total_rounds=num_rounds,
                    last_ranking=last_ranking,
                )

    return MultiRoundAuctionResult(
        rounds=rounds,
        final_winner={
            "name": final_winner["name"],
            "final_score": final_winner["final_score"],
            "money_score": final_winner["money_score"],
            "social_score": final_winner["social_score"],
            "bid": final_winner["profile"]["max_bid"],
            "social_reason": final_winner["social_reason"],
        },
        social_mode=social_mode or ("gemini" if use_gemini_flag else "rule-based"),
    )

# CLI demo – reads EVERYTHING from JSON

if __name__ == "__main__":
    config = load_config("auction_config.json")
    result = run_multi_round_auction(config)
    data = result.to_dict()

    print("Social mode used:", data["social_mode"])
    print("====== Multi-round auction summary ======\n")

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
    print("====== Final winner ======")
    print(
        f"{fw['name']} "
        f"(final={fw['final_score']}, money={fw['money_score']}, "
        f"social={fw['social_score']}, bid={fw['bid']})"
    )
    print("Reason:", fw["social_reason"])
