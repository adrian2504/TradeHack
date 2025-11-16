import os
from google import genai

# Load Gemini API key from environment
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise ValueError("❌ GEMINI_API_KEY is missing. Set it in your environment variables.")

# Initialize Gemini client
client = genai.Client(api_key=GEMINI_API_KEY)


# ----------------------------------------------------------
# Gemini helper function
# ----------------------------------------------------------
def ask_gemini(model: str, prompt: str) -> str:
    """
    Sends a prompt to Gemini and returns the model's text response.
    """
    try:
        response = client.models.generate(
            model=model,
            prompt=prompt
        )
        return response.text
    except Exception as e:
        return f"Gemini error: {str(e)}"


# ----------------------------------------------------------
# Social Score Engine
# ----------------------------------------------------------
def calculate_social_score(profile_data: dict) -> float:
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

    text = ask_gemini("gemini-1.5-flash", prompt)

    # Extract numeric value
    try:
        score = float(text.strip())
    except:
        score = 50.0  # fallback

    return max(0, min(100, score))


# ----------------------------------------------------------
# Bid Fairness Normalization
# ----------------------------------------------------------
def normalize_bid(bid_amount: float, social_score: float) -> float:
    """
    Combines bid amount + social score into a normalized ranking value.
    Higher = more likely to win.
    """
    return (bid_amount * 0.7) + (social_score * 0.3)


# ----------------------------------------------------------
# Multi-Agent Auction Logic
# ----------------------------------------------------------
def run_multi_agent_auction(bidders: list):
    """
    bidders = [
        {"user_id": "123", "bid": 90, "profile": {...}},
        {"user_id": "abc", "bid": 85, "profile": {...}}
    ]

    Returns:
    {
        "winner": {...},
        "rankings": [...]
    }
    """

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
