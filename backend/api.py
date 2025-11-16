from typing import List, Any, Dict
from fastapi import FastAPI
from pydantic import BaseModel
from auction_engine import rank_profiles

class Profile(BaseModel):
    name: str
    country: str
    start_bid: float
    max_bid: float
    profession: str
    social_contribution: str

class AuctionRequest(BaseModel):
    profiles: List[Profile]
    use_gemini: bool = True
    social_weight: float = 0.7

class RankedProfile(BaseModel):
    name: str
    money_score: float
    social_score: float
    final_score: float
    social_reason: str
    edge_multiplier_info: str
    profile: Dict[str, Any]

class AuctionResponse(BaseModel):
    social_mode: str
    winner: RankedProfile
    ranking: List[RankedProfile]

app = FastAPI()

@app.post("/run-auction", response_model=AuctionResponse)
def run_auction(req: AuctionRequest):
    profiles_list = [p.model_dump() for p in req.profiles]
    result = rank_profiles(profiles=profiles_list, social_weight=req.social_weight, use_gemini=req.use_gemini)
    return {
        "social_mode": result["social_mode"],
        "winner": result["winner"],
        "ranking": result["ranking"]
    }
