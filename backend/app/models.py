from pydantic import BaseModel, Field
from typing import List, Optional

class BidderProfile(BaseModel):
    name: str
    country: str
    start_bid: int
    max_bid: int = Field(..., gt=0, description="Max bid, must be > 0")
    profession: str
    social_contribution: str

class AuctionRequest(BaseModel):
    profiles: List[BidderProfile]
        social_weight: float = Field(
        default=0.7, 
        ge=0.0, 
        le=1.0, 
        description="Weight for social score (0.0 to 1.0)"
    )
    
    use_gemini: bool = True

class AuctionRankItem(BaseModel):
    name: str
    money_score: float
    social_score: float
    final_score: float
    social_reason: str
    profile: BidderProfile
    
    solana_tx_id: Optional[str] = None
    solana_tx_url: Optional[str] = None

class AuctionResult(BaseModel):
    ranking: List[AuctionRankItem]
    winner: AuctionRankItem
    social_mode: str
