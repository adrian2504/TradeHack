import os
import re
import json
import asyncio

from typing import List, Dict, Any, Tuple, Optional
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import NoResultFound

from . import sql_models

# Try to import Gemini SDK
try:
    from google import genai
    from google.genai import types as genai_types
except ImportError:
    genai = None

# ----------------- CUSTOM EXCEPTION ----------------- #

class AuctionError(Exception):
    """Custom exception for auction-related errors (e.g., not found)."""
    pass

# ----------------- ENV + CLIENT SETUP ----------------- #

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
gemini_client: Optional["genai.Client"] = None

if GEMINI_API_KEY and genai is not None:
    base_client = genai.Client(api_key=GEMINI_API_KEY)

    # Get the async-specific client from the .aio attribute
    gemini_async_client = base_client.aio 

else:
    print("Warning: GEMINI_API_KEY not found or google-genai not installed.")
    gemini_async_client = None

# ----------------- UTILS ----------------- #

def clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))

def extract_json_from_text(text: str) -> Dict[str, Any]:
    """
    Try to robustly extract a JSON object from a model response.
    """
    cleaned = text.strip()

    # Strip markdown fences like ```json ... ```
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

# ----------------- MONEY SCORE ----------------- #

def compute_money_scores(profiles: List[Dict[str, Any]]) -> Dict[str, float]:
    # This function operates on the "max_bid" field
    max_bids = [p["max_bid"] for p in profiles]
    if not max_bids:
        return {}
        
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

# ----------------- RULE-BASED SOCIAL SCORE ----------------- #

POSITIVE_KEYWORDS = [
    "hungry children", "children", "women", "girls", "human rights",
    "refugee", "education", "school", "healthcare", "hospital",
    "disability", "poverty", "homeless", "planting trees", "trees",
    "environment", "climate", "clean water",
]

NEGATIVE_PROFESSIONS = [
    "tobacco", "arms dealer", "weapons", "gambling", "casino",
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

def compute_social_score_rule_based(profile: Dict[str, Any]) -> Tuple[float, str]:
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

    reason = "Rule-based: profession + keywords + donation amount."
    return clamp(score), reason

def compute_social_scores_rule_based(
    profiles: List[Dict[str, Any]]
) -> Dict[str, Tuple[float, str]]:
    scores: Dict[str, Tuple[float, str]] = {}
    for p in profiles:
        scores[p["name"]] = compute_social_score_rule_based(p)
    return scores

# ----------------- GEMINI SOCIAL SCORE (ASYNC) ----------------- #

async def compute_social_score_gemini(
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

    try:
        if not gemini_async_client:
            raise Exception("Gemini async client is not initialized.")

        # Define the config *inside* the function
        json_config = genai_types.GenerateContentConfig(
            response_mime_type="application/json"
        )

        # Call .generate_content() on the async client's .models
        response = await gemini_async_client.models.generate_content(
            model="models/gemini-1.5-pro-latest", 
            contents=prompt,
            generation_config=json_config  
        )

        raw_text = response.text.strip()
        data = extract_json_from_text(raw_text)
        score = float(data["social_score"])
        reason = str(data.get("reason", "")).strip()
        return clamp(score), reason or "AI-based social impact evaluation."

    except Exception as e:
        print(f"Error from Gemini for profile '{profile['name']}': {e}. Falling back to rule-based.")
        fallback_score, fallback_reason = compute_social_score_rule_based(profile)
        fallback_reason = (
            "Fallback: Gemini output error, used rule-based scoring instead."
        )
        return fallback_score, fallback_reason

async def compute_social_scores_gemini(
    profiles: List[Dict[str, Any]],
    client: "genai.Client",
) -> Dict[str, Tuple[float, str]]:
    
    # Create a list of tasks to run in parallel
    tasks = []
    for p in profiles:
        tasks.append(compute_social_score_gemini(p, client))
    
    results = await asyncio.gather(*tasks)
    
    # Map results back to profile names
    scores: Dict[str, Tuple[float, str]] = {}
    for i, p in enumerate(profiles):
        scores[p["name"]] = results[i]
        
    return scores

# ----------------- RANKING LOGIC (ASYNC) ----------------- #

async def rank_profiles(
    profiles: List[Dict[str, Any]],
    social_weight: float = 0.7,
    fairness_weight: float = 0.0, # Added from your schema
    use_gemini: bool = True,
) -> Dict[str, Any]:
    
    if not profiles:
        raise ValueError("No profiles provided")

    money_scores = compute_money_scores(profiles)

    if use_gemini and gemini_client is not None:
        social_scores_raw = await compute_social_scores_gemini(profiles, gemini_client)
        social_mode = "gemini"
    else:
        social_scores_raw = compute_social_scores_rule_based(profiles)
        social_mode = "rule-based"

    # Use the weights passed in
    WEIGHT_SOCIAL = clamp(social_weight)
    
    # Calculate money weight based on social weight
    # (Assuming fairness is a separate factor, or we can adjust)
    # For now, let's assume social + money = 1.0
    WEIGHT_MONEY = 1.0 - WEIGHT_SOCIAL
    # We can incorporate fairness_weight later

    results = []
    for p in profiles:
        name = p["name"]
        money_score = money_scores.get(name, 0.0)
        social_score, reason = social_scores_raw.get(name, (0.0, "Error"))

        final_score = (WEIGHT_SOCIAL * social_score) + (WEIGHT_MONEY * money_score)

        results.append(
            {
                "name": name,
                "money_score": round(money_score, 3),
                "social_score": round(social_score, 3),
                "final_score": round(final_score, 3),
                "social_reason": reason,
                "profile": p, # Contains the original profile dict
            }
        )

    results_sorted = sorted(results, key=lambda x: -x["final_score"])
    winner = results_sorted[0] if results_sorted else None

    return {
        "ranking": results_sorted,
        "winner": winner,
        "social_mode": social_mode,
    }

# ----------------- DB-DRIVEN ENTRY POINT ----------------- #

async def run_auction_from_db(auction_id: str, db: Session) -> dict:
    """
    The new main entry point called by FastAPI.
    Fetches data from the DB and runs the auction engine.
    """
    
    # Fetch Auction from DB 
    try:
        # Fetch the Auction by its ID
        auction = db.query(sql_models.Auction).filter(
            sql_models.Auction.auction_id == auction_id
        ).one()
    except NoResultFound:
        raise AuctionError(f"Auction with id {auction_id} not found.")

    if auction.status == 'COMPLETED':
        raise AuctionError(f"Auction {auction_id} is already completed.")

    # Fetch Bids and Users from DB 
    # Use the 'bids' relationship defined in sql_models.py
    # This automatically gets all bids for this auction
    bids = auction.bids 
    
    if not bids:
        raise AuctionError(f"No bids found for auction {auction_id}.")

    # Translate DB Models into Profile Dicts 
    # This list of dicts is what our rank_profiles function expects
    profiles_list = []
    for bid in bids:
        user = bid.user # Access the 'user' via the relationship
        if not user:
            print(f"Warning: Bid {bid.bid_id} has no associated user. Skipping.")
            continue
        
        # print(user.composite_score)
        
        profiles_list.append({
            "name": user.name,
            # Map DB columns to the keys our engine expects
            "country": user.affiliation or "Unknown", 
            "start_bid": bid.bid_amount,
            "max_bid": bid.bid_amount, # In this schema, bid_amount is the max bid
            "profession": user.affiliation or "Unknown", 
            "social_contribution": f"Philanthropy Score: {user.philanthropy_score}. Impact Score: {user.socialimpact_score}. Strategy: {user.strategy}",
            
            # Store original IDs for use in main.py
            "user_id": user.user_id,
            "bid_id": bid.bid_id
        })
    
    if not profiles_list:
        raise AuctionError("No valid bids with associated users found.")

    # Run the Async Ranking Logic
    result = await rank_profiles(
        profiles=profiles_list,
        social_weight=auction.profile_weight, # Use weight from DB
        fairness_weight=auction.fairness_weight, # Use weight from DB
        use_gemini=True 
    )
    
    # Return the final result dictionary 
    # main.py will be responsible for committing any DB changes
    return result