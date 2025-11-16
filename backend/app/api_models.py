from pydantic import BaseModel, Field
from typing import List, Optional

class BidderProfile(BaseModel):
    """
    Defines the data required for a single bidder's profile.
    This is the core input for the auction engine.
    """
    name: str
    country: str
    start_bid: int
    max_bid: int = Field(..., gt=0, description="Max bid, must be > 0")
    profession: str
    social_contribution: str

class AuctionRequest(BaseModel):
    """
    The JSON body sent from the frontend to the /run-auction endpoint.
    """
    # A list of all bidders participating
    profiles: List[BidderProfile]
    
    # The 'reputation_priority' slider from the UI (0.0 to 1.0)
    social_weight: float = Field(
        default=0.7, 
        ge=0.0, 
        le=1.0, 
        description="Weight for social score (0.0 to 1.0)"
    )
    
    # A toggle to use Gemini or not
    use_gemini: bool = True


class AuctionRankItem(BaseModel):
    """
    The detailed result for a single bidder in the final ranking.
    """
    name: str
    money_score: float
    social_score: float
    final_score: float
    social_reason: str
    profile: BidderProfile  # The original profile is included
    
    # We will add the Solana info here
    solana_tx_id: Optional[str] = None
    solana_tx_url: Optional[str] = None

class AuctionResult(BaseModel):
    """
    The final, complete response object sent back to the frontend.
    """
    ranking: List[AuctionRankItem]
    winner: AuctionRankItem  # The winning item is one of the items in 'ranking'
    social_mode: str