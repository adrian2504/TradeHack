# backend/app/main.py
import os
import logging
from typing import List, Dict, Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .models import AuctionRequest, AuctionResult, BidderProfile, AuctionRankItem

from . import auction_engine 

from . import solana_service 

# --- Logging ---
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=LOG_LEVEL)
logger = logging.getLogger("hacknyu.auction")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PROJECT_WALLETS = {
    "default_project": os.getenv("PROJECT_WALLET_PUBLIC_KEY", "YOUR_PROJECT_WALLET_PUBLIC_KEY_HERE")
}

# From-wallet secret key for demo settlement:
# WARNING: For production do NOT hardcode private keys. Use secure vaults.
FROM_WALLET_SECRET_KEY = os.getenv("FROM_WALLET_SECRET_KEY", None)


@app.get("/")
def root():
    return {"status": "ok", "message": "HACKNYU Auction API running"}


@app.post("/api/v1/run-auction", response_model=AuctionResult)
async def run_auction(request: AuctionRequest):
    profiles_as_dicts: List[Dict[str, Any]] = [
        p.model_dump() for p in request.profiles
    ]

    try:
        result_dict = auction_engine.rank_profiles(
            profiles=profiles_as_dicts,
            social_weight=request.social_weight,
            use_gemini=request.use_gemini
        )

        winner_data = result_dict["winner"]
        winner_profile = BidderProfile(**winner_data["profile"])
        winning_bid_amount = winner_profile.max_bid
    
        FROM_WALLET_SECRET_KEY = "YOUR_HARDCODED_WINNER_SECRET_KEY_FOR_DEMO"
        TO_WALLET_PUBLIC_KEY = PROJECT_WALLETS["default_project"]

        tx_id = await solana_service.settle_on_solana(
            from_secret_key=FROM_WALLET_SECRET_KEY,
            to_public_key=TO_WALLET_PUBLIC_KEY,
            amount=winning_bid_amount
        )
        tx_url = f"https://explorer.solana.com/tx/{tx_id}?cluster=devnet"

        winner_data["solana_tx_id"] = tx_id
        winner_data["solana_tx_url"] = tx_url

        for item in result_dict["ranking"]:
            if item["name"] == winner_data["name"]:
                item["solana_tx_id"] = tx_id
                item["solana_tx_url"] = tx_url
                break

        return AuctionResult(**result_dict)

    except Exception as e:
        print(f"Error during auction: {e}")
        raise HTTPException(status_code=500, detail=str(e))
