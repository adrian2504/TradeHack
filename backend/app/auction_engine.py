import os
import re
import json
from typing import List, Dict, Any, Tuple, Optional
from dotenv import load_dotenv

try:
    from google import genai
except ImportError:
    genai = None


load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")


gemini_client: Optional["genai.Client"] = None

if GEMINI_API_KEY and genai is not None:
    gemini_client = genai.Client(api_key=GEMINI_API_KEY)


def clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def extract_json_from_text(text: str) -> Dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if "{" in cleaned:
            cleaned = cleaned[cleaned.index("{"):]
        else:
            raise ValueError("No JSON object found in fenced block")

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object found")

    json_str = cleaned[start : end + 1]
    return json.loads(json_str)

def compute_money_scores(profiles: List[Dict[str, Any]]) -> Dict[str, float]:
    max_bids = [p["max_bid"] for p in profiles]
    min_bid = min(max_bids)
    max_bid = max(max_bids)

    scores: Dict[str, float] = {}

    for p in profiles:
        if max_bid == min_bid:
            score = 1.0
        else:
            score = (p["max_bid"] - min_bid) / (max_bid - min_bid)
        scores[p["name"]] = clamp(score)

    return scores

POSITIVE_KEYWORDS = [
    "hungry children",
    "children",
    "women",
    "girls",
    "human rights",
    "refugee",
    "education",
    "school",
    "healthcare",
    "hospital",
    "disability",
    "poverty",
    "homeless",
    "planting trees",
    "trees",
    "environment",
    "climate",
    "clean water",
]

NEGATIVE_PROFESSIONS = [
    "tobacco",
    "arms dealer",
    "weapons",
    "gambling",
    "casino",
]


def extract_donation_amount(text: str) -> float:
    amounts = re.findall(r"\$?\s*([\d,]+)", text)
    vals = []
    for a in amounts:
        a_clean = a.replace(",", "")
        try:
            vals.append(float(a_clean))
        except ValueError:
            pass
    return max(vals) if vals else 0.0


def compute_social_score_rule_based(profile: Dict[str, Any]) -> float:
    profession = profile["profession"].lower()
    contrib = profile["social_contribution"].lower()

    score = 0.5

    for bad in NEGATIVE_PROFESSIONS:
        if bad in profession:
            score -= 0.3

    if "lawyer" in profession or "doctor" in profession or "teacher" in profession:
        score += 0.1

    for kw in POSITIVE_KEYWORDS:
        if kw in contrib:
            score += 0.05

    donation = extract_donation_amount(profile["social_contribution"])
    donation_bonus = clamp(donation / 10000.0, 0.0, 0.2)
    score += donation_bonus

    return clamp(score)


def compute_social_scores_rule_based(
    profiles: List[Dict[str, Any]]
) -> Dict[str, Tuple[float, str]]:
    scores: Dict[str, Tuple[float, str]] = {}
    for p in profiles:
        s = compute_social_score_rule_based(p)
        reason = "Rule-based: profession + keywords + donation amount."
        scores[p["name"]] = (s, reason)
    return scores


def compute_social_score_gemini(
    profile: Dict[str, Any],
    client: "genai.Client",
) -> Tuple[float, str]:
    """
    Ask Gemini to evaluate the social impact of a profile.
    Returns (score, reason).
    """
    prompt = f"""
You are an evaluator that scores people based on positive social impact and ethical alignment.

Profile:
- Name: {profile["name"]}
- Country: {profile["country"]}
- Profession: {profile["profession"]}
- Social contribution: {profile["social_contribution"]}

Scoring rules:
- Harmful industries (e.g., tobacco, weapons, hard drugs, exploitative gambling) should receive lower scores.
- Contributions helping vulnerable groups (children, women, refugees, sick people, poor communities) should increase the score.
- Contributions to education, healthcare, environment, human rights and poverty reduction should increase the score.
- Donation amount matters, but ethics and impact of the action matter more than raw money.
- The score MUST be between 0 and 1.

Output format:
Respond STRICTLY as JSON, with NO markdown, NO code fences, and NO extra commentary.
The JSON MUST have this exact structure:
{{
  "social_score": <number between 0 and 1>,
  "reason": "Short 1-3 sentence explanation."
}}
    """.strip()

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )

    raw_text = response.text.strip()

    try:
        data = extract_json_from_text(raw_text)
        score = float(data["social_score"])
        reason = str(data.get("reason", "")).strip()
        return clamp(score), reason or "AI-based social impact evaluation."
    except Exception:
        fallback_score = compute_social_score_rule_based(profile)
        fallback_reason = (
            "Fallback: Gemini output not parseable as JSON, used rule-based scoring instead."
        )
        return fallback_score, fallback_reason


def compute_social_scores_gemini(
    profiles: List[Dict[str, Any]],
    client: "genai.Client",
) -> Dict[str, Tuple[float, str]]:
    scores: Dict[str, Tuple[float, str]] = {}
    for p in profiles:
        score, reason = compute_social_score_gemini(p, client)
        scores[p["name"]] = (score, reason)
    return scores

def rank_profiles(
    profiles: List[Dict[str, Any]],
    social_weight: float = 0.7, 
    use_gemini: bool = True,
) -> Dict[str, Any]:
    if not profiles:
        raise ValueError("No profiles provided")

    money_scores = compute_money_scores(profiles)

    if use_gemini and gemini_client is not None:
        social_scores_raw = compute_social_scores_gemini(profiles, gemini_client)
        social_mode = "gemini"
    else:
        social_scores_raw = compute_social_scores_rule_based(profiles)
        social_mode = "rule-based"

    WEIGHT_SOCIAL = clamp(social_weight)
    WEIGHT_MONEY = 1.0 - WEIGHT_SOCIAL

    results = []
    for p in profiles:
        name = p["name"]
        money_score = money_scores[name]
        social_score, reason = social_scores_raw[name]

        final_score = WEIGHT_SOCIAL * social_score + WEIGHT_MONEY * money_score

        results.append(
            {
                "name": name,
                "money_score": round(money_score, 3),
                "social_score": round(social_score, 3),
                "final_score": round(final_score, 3),
                "social_reason": reason,
                "profile": p,
            }
        )

    results_sorted = sorted(results, key=lambda x: -x["final_score"])
    winner = results_sorted[0]

    return {
        "ranking": results_sorted,
        "winner": winner,
        "social_mode": social_mode,
    }

# if __name__ == "__main__":
#     profiles_demo = [
#         {
#             "name": "Adrian Dsouza",
#             "country": "United States",
#             "start_bid": 50000,
#             "max_bid": 100000,
#             "profession": "Lawyer",
#             "social_contribution": (
#                 "Donated 5000 for hungry children in NYC, "
#                 "helped fight for the right of women."
#             ),
#         },
#         {
#             "name": "Charles Dsouza",
#             "country": "United States",
#             "start_bid": 100000,
#             "max_bid": 200000,
#             "profession": "Tobacco Factory",
#             "social_contribution": "Donated $1000 for planting trees.",
#         },
#     ]

#     use_gemini_flag = bool(gemini_client)

#     result = rank_profiles(profiles_demo, use_gemini=use_gemini_flag)

#     print(f"Social scoring mode: {result['social_mode']}")
#     print("---- Winner ----")
#     print(f"Name: {result['winner']['name']}")
#     print(f"Final score: {result['winner']['final_score']}")
#     print(f"Money score: {result['winner']['money_score']}")
#     print(f"Social score: {result['winner']['social_score']}")
#     print(f"Reason: {result['winner']['social_reason']}")
#     print()

#     print("---- Full ranking ----")
#     for r in result["ranking"]:
#         print(
#             f"{r['name']}: final={r['final_score']}, "
#             f"money={r['money_score']}, social={r['social_score']}"
#         )
#         print(f"  Reason: {r['social_reason']}")
#         print()

