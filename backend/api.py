from typing import List, Any, Dict

from fastapi import FastAPI
from pydantic import BaseModel

from auction_core import rank_profiles  # import your logic


# ---------- Pydantic models for request/response ----------

class Profile(BaseModel):
    name: str
    country: str
    start_bid: float
    max_bid: float
    profession: str
    social_contribution: str


class AuctionRequest(BaseModel):
    profiles: List[Profile]
    use_gemini: bool = True  # allow toggling AI scoring if needed


class RankedProfile(BaseModel):
    name: str
    money_score: float
    social_score: float
    final_score: float
    social_reason: str
    profile: Dict[str, Any]


class AuctionResponse(BaseModel):
    social_mode: str
    winner: RankedProfile
    ranking: List[RankedProfile]


# ---------- FastAPI app ----------

app = FastAPI(title="AI Social Auction API")


@app.get("/")
def root():
    return {"message": "AI Auction API is running. POST /run-auction to evaluate profiles."}


@app.post("/run-auction", response_model=AuctionResponse)
def run_auction(req: AuctionRequest):
    # Convert Pydantic models to plain dicts
    profiles_list = [p.model_dump() for p in req.profiles]

    result = rank_profiles(
        profiles=profiles_list,
        use_gemini=req.use_gemini,
    )

    # FastAPI will auto-coerce dicts into the response_model
    return {
        "social_mode": result["social_mode"],
        "winner": result["winner"],
        "ranking": result["ranking"],
    }
