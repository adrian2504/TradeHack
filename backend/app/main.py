from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any

# Import our new models
from .models import AuctionRequest, AuctionResult, BidderProfile, AuctionRankItem

# Import our new engine
from . import auction_engine 

# Import our existing solana service
from . import solana_service 

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory database of project wallets
PROJECT_WALLETS = {
    "default_project": "YOUR_PROJECT_WALLET_PUBLIC_KEY_HERE"
}

@app.post("/api/v1/run-auction", response_model=AuctionResult)
async def run_auction(request: AuctionRequest):
    """
    Main API endpoint to run the entire auction.
    """
    
    # 1. Convert Pydantic models to plain dicts for the engine
    profiles_as_dicts: List[Dict[str, Any]] = [
        p.model_dump() for p in request.profiles
    ]

    try:
        # 2. Run the auction engine
        result_dict = auction_engine.rank_profiles(
            profiles=profiles_as_dicts,
            social_weight=request.social_weight,
            use_gemini=request.use_gemini
        )

        # 3. Get winner info from the result
        winner_data = result_dict["winner"]
        winner_profile = BidderProfile(**winner_data["profile"]) # Re-create model
        winning_bid_amount = winner_profile.max_bid
        
        # In a real app, you'd look up the winner's wallet.
        # For a hackathon, we'll use a placeholder.
        FROM_WALLET_SECRET_KEY = "YOUR_HARDCODED_WINNER_SECRET_KEY_FOR_DEMO"
        TO_WALLET_PUBLIC_KEY = PROJECT_WALLETS["default_project"]

        # 4. Settle on Solana
        tx_id = await solana_service.settle_on_solana(
            from_secret_key=FROM_WALLET_SECRET_KEY,
            to_public_key=TO_WALLET_PUBLIC_KEY,
            amount=winning_bid_amount
        )
        tx_url = f"https://explorer.solana.com/tx/{tx_id}?cluster=devnet"

        # 5. Add Solana info to the winner object
        winner_data["solana_tx_id"] = tx_id
        winner_data["solana_tx_url"] = tx_url

        # Also update the winner in the main ranking list
        for item in result_dict["ranking"]:
            if item["name"] == winner_data["name"]:
                item["solana_tx_id"] = tx_id
                item["solana_tx_url"] = tx_url
                break
        
        # 6. Validate and return the final result
        # This parse-and-return step ensures our output matches the 
        # 'AuctionResult' Pydantic model.
        return AuctionResult(**result_dict)

    except Exception as e:
        # Catch errors from the engine or Solana
        print(f"Error during auction: {e}")
        raise HTTPException(status_code=500, detail=str(e))