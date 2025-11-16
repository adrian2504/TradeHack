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

# Load Gemini API key from environment
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise ValueError("❌ GEMINI_API_KEY is missing. Set it in your environment variables.")

# Initialize Gemini client
client = genai.Client(api_key=GEMINI_API_KEY)


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
    Uses Gemini to analyze user profile data and give a numerical score (0-100).
    """
    prompt = f"""
    Analyze the following user profile and return ONLY a social trust score (0-100).
    Profile data:
    {profile_data}

    Score criteria:
    - Communication clarity
    - Past behavior or signals
    - Cooperation likelihood
    - No ethics or moral judgment
    - Pure behavioral prediction

    Return ONLY a number.
    """

    raw_text = response.text.strip()

    # Extract numeric value
    try:
        score = float(text.strip())
    except:
        score = 50.0  # fallback

    return max(0, min(100, score))


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

    processed = []

    for b in bidders:
        social_score = calculate_social_score(b["profile"])
        normalized = normalize_bid(b["bid"], social_score)

        processed.append({
            "user_id": b["user_id"],
            "bid": b["bid"],
            "social_score": social_score,
            "normalized_score": normalized
        })

    # Sort descending by normalized score
    rankings = sorted(processed, key=lambda x: x["normalized_score"], reverse=True)

    return {
        "winner": rankings[0],
        "rankings": rankings
    }


# ----------------------------------------------------------
# Agent Explanation System (optional, but helpful for UI)
# ----------------------------------------------------------
def explain_decision(winner_data: dict):
    """
    Uses Gemini to generate a human-readable explanation of why the model
    selected the winning bidder.
    """

    prompt = f"""
    The system selected this winner:

    {winner_data}

    Explain briefly and clearly why this bidder won,
    referencing:
    - Bid value
    - Social score
    - Normalized score

    Keep the explanation under 120 words.
    """

    return ask_gemini("gemini-1.5-flash", prompt)
