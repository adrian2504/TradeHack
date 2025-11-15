from __future__ import annotations

from typing import List, Dict, Any, Optional
import copy

from auction_core import rank_profiles

Profile = Dict[str, Any]


class AuctionRoundResult:
    def __init__(
        self,
        round_index: int,
        ranking: List[Dict[str, Any]],
        winner: Dict[str, Any],
    ):
        self.round_index = round_index
        self.ranking = ranking
        self.winner = winner

    def to_dict(self) -> Dict[str, Any]:
        return {
            "round_index": self.round_index,
            "ranking": self.ranking,
            "winner": self.winner,
        }


class MultiRoundAuctionResult:
    def __init__(
        self,
        rounds: List[AuctionRoundResult],
        final_winner: Dict[str, Any],
        social_mode: str,
    ):
        self.rounds = rounds
        self.final_winner = final_winner
        self.social_mode = social_mode

    def to_dict(self) -> Dict[str, Any]:
        return {
            "social_mode": self.social_mode,
            "final_winner": self.final_winner,
            "rounds": [r.to_dict() for r in self.rounds],
        }


def _init_agent_state(profiles: List[Profile]) -> List[Dict[str, Any]]:
    """
    Prepare internal state for each agent:
    - Keep original profile
    - Track current_bid (starts at start_bid)
    - Track true_max_bid (from profile["max_bid"])
    """
    state = []
    for p in profiles:
        prof = copy.deepcopy(p)

        start_bid = float(prof.get("start_bid", 0.0))
        max_bid = float(prof.get("max_bid", 0.0))

        if start_bid > max_bid:
            start_bid, max_bid = max_bid, max_bid

        state.append(
            {
                "profile": prof,
                "current_bid": start_bid,
                "true_max_bid": max_bid,
                "history": [],
            }
        )
    return state


def _apply_bidding_strategy(
    agents_state: List[Dict[str, Any]],
    last_round_ranking: Optional[List[Dict[str, Any]]],
    round_index: int,
    total_rounds: int,
):

    rank_index_by_name = {}
    if last_round_ranking is not None:
        for idx, entry in enumerate(last_round_ranking):
            rank_index_by_name[entry["name"]] = idx

    num_agents = len(agents_state)

    for agent in agents_state:
        name = agent["profile"]["name"]
        current_bid = float(agent["current_bid"])
        true_max = float(agent["true_max_bid"])

        if true_max <= 0:
            continue

        if name in rank_index_by_name:
            position = rank_index_by_name[name]
        else:
            position = num_agents // 2
        if num_agents > 1:
            loser_factor = position / (num_agents - 1)
        else:
            loser_factor = 0.0

        remaining = max(0.0, true_max - current_bid)
        if remaining <= 0:
            continue

        rounds_left = max(1, total_rounds - round_index)

        base_fraction = 0.4
        raise_fraction = base_fraction * (0.3 + 0.7 * loser_factor)
        planned_raise = remaining * raise_fraction
        planned_raise = min(planned_raise, remaining / rounds_left)

        new_bid = current_bid + planned_raise
        if new_bid > true_max:
            new_bid = true_max

        agent["current_bid"] = round(new_bid, 2)


def _profiles_for_round(agents_state: List[Dict[str, Any]]) -> List[Profile]:
    round_profiles: List[Profile] = []
    for agent in agents_state:
        prof = copy.deepcopy(agent["profile"])
        current = agent["current_bid"]
        prof["start_bid"] = current
        prof["max_bid"] = current
        round_profiles.append(prof)
    return round_profiles

def run_multi_round_auction(
    profiles: List[Profile],
    num_rounds: int = 3,
    use_gemini_social: bool = True,
) -> MultiRoundAuctionResult:

    if num_rounds < 1:
        raise ValueError("num_rounds must be >= 1")
    if not profiles:
        raise ValueError("No profiles provided")

    agents_state = _init_agent_state(profiles)
    rounds: List[AuctionRoundResult] = []
    last_ranking: Optional[List[Dict[str, Any]]] = None
    social_mode_used: Optional[str] = None
    final_winner: Optional[Dict[str, Any]] = None

    for r in range(num_rounds):
        round_index = r + 1
        round_profiles = _profiles_for_round(agents_state)
        result = rank_profiles(
            profiles=round_profiles,
            use_gemini=use_gemini_social,
        )
        if social_mode_used is None:
            social_mode_used = result["social_mode"]

        round_winner = result["winner"]
        round_ranking = result["ranking"]
        rounds.append(
            AuctionRoundResult(
                round_index=round_index,
                ranking=round_ranking,
                winner=round_winner,
            )
        )
        final_winner = round_winner
        last_ranking = round_ranking
        if round_index < num_rounds:
            _apply_bidding_strategy(
                agents_state=agents_state,
                last_round_ranking=last_ranking,
                round_index=round_index,
                total_rounds=num_rounds,
            )

    return MultiRoundAuctionResult(
        rounds=rounds,
        final_winner=final_winner,
        social_mode=social_mode_used or ("gemini" if use_gemini_social else "rule-based"),
    )


if __name__ == "__main__":
    demo_profiles: List[Profile] = [
        {
            "name": "Adrian Dsouza",
            "country": "United States",
            "start_bid": 50000,
            "max_bid": 100000,
            "profession": "Lawyer",
            "social_contribution": (
                "Donated 5000 for hungry children in NYC, "
                "helped fight for the right of women."
            ),
        },
        {
            "name": "Charles Dsouza",
            "country": "United States",
            "start_bid": 100000,
            "max_bid": 200000,
            "profession": "Tobacco Factory",
            "social_contribution": "Donated $1000 for planting trees.",
        },
        {
            "name": "Random Investor",
            "country": "United States",
            "start_bid": 75000,
            "max_bid": 300000,
            "profession": "crypto fund manager",
            "social_contribution": "Invested in some startups and once sponsored a tech meetup.",
        },
    ]

    result = run_multi_round_auction(
        profiles=demo_profiles,
        num_rounds=3,
        use_gemini_social=True,
    )

    data = result.to_dict()

    print(f"Social mode: {data['social_mode']}")
    print("====== Multi-round auction summary ======\n")

    for round_info in data["rounds"]:
        print(f"--- Round {round_info['round_index']} ---")
        print(f"Winner: {round_info['winner']['name']} "
              f"(final_score={round_info['winner']['final_score']}, "
              f"bid={round_info['winner']['profile']['max_bid']})")
        print("Ranking:")
        for entry in round_info["ranking"]:
            print(
                f"  {entry['name']}: final={entry['final_score']}, "
                f"money={entry['money_score']}, social={entry['social_score']}, "
                f"bid={entry['profile']['max_bid']}"
            )
        print()

    print("====== Final winner ======")
    print(
        f"{data['final_winner']['name']} "
        f"(final_score={data['final_winner']['final_score']}, "
        f"money={data['final_winner']['money_score']}, "
        f"social={data['final_winner']['social_score']}, "
        f"bid={data['final_winner']['profile']['max_bid']})"
    )
    print(f"Reason: {data['final_winner']['social_reason']}")
