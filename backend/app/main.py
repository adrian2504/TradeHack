# backend/app/main.py
import os
import logging
from typing import List, Dict, Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# load environment (create backend/.env from infra/env.example)
load_dotenv()

# Import our Pydantic models and engine
from .models import AuctionRequest, AuctionResult, BidderProfile
from . import auction_engine

# Import solana_service (your implementation) - it must expose async settle_on_solana(...)
from . import solana_service

# --- Logging ---
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=LOG_LEVEL)
logger = logging.getLogger("hacknyu.auction")

app = FastAPI(title="HACKNYU Auction API")

# CORS for local dev (adjust origins as needed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory project wallets (demo)
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
    """
    Main API endpoint to run the entire auction:
      1) Converts Pydantic input to plain dicts
      2) Calls auction_engine.rank_profiles(...) which uses Gemini + local/edge model
      3) Attempts to settle the winning bid on Solana (devnet) via solana_service.settle_on_solana
      4) Attaches tx info to the winner and ranking and returns AuctionResult
    """
    profiles_as_dicts: List[Dict[str, Any]] = [p.model_dump() for p in request.profiles]

    try:
        # 1) Run the auction engine (may call Gemini and edge model internally)
        logger.info("Running auction engine for %d profiles (use_gemini=%s)", len(profiles_as_dicts), request.use_gemini)
        result_dict = auction_engine.rank_profiles(
            profiles=profiles_as_dicts,
            social_weight=request.social_weight,
            use_gemini=request.use_gemini
        )

        # 2) Extract winner and determine bid amount
        winner_data = result_dict["winner"]
        # Winner profile is the original profile dict
        try:
            winner_profile = BidderProfile(**winner_data["profile"])
        except Exception as e:
            logger.warning("Failed to parse winner profile into BidderProfile: %s", e)
            # Fall back to using the dict directly but still attempt settlement
            winner_profile = None

        # Choose amount to transfer: prefer max_bid, fallback to start_bid, fallback to final_score scaled
        if winner_profile is not None:
            winning_bid_amount = float(getattr(winner_profile, "max_bid", getattr(winner_profile, "start_bid", 0)))
        else:
            winning_bid_amount = float(winner_data.get("profile", {}).get("max_bid",
                                         winner_data.get("profile", {}).get("start_bid", 0)))

        # Small sanity check
        if winning_bid_amount <= 0:
            logger.warning("Winning bid amount is zero or missing; setting to 0")
            winning_bid_amount = 0

        # 3) Resolve recipient and sender wallet keys (demo: using placeholder)
        TO_WALLET_PUBLIC_KEY = PROJECT_WALLETS.get("default_project")
        FROM_SECRET_KEY = FROM_WALLET_SECRET_KEY

        tx_id = None
        tx_url = None

        # If solana_service available and we have a source key and amount > 0 -> attempt settlement
        if winning_bid_amount > 0 and FROM_SECRET_KEY and TO_WALLET_PUBLIC_KEY:
            try:
                logger.info("Settling on Solana: amount=%s", winning_bid_amount)
                tx_id = await solana_service.settle_on_solana(
                    from_secret_key=FROM_SECRET_KEY,
                    to_public_key=TO_WALLET_PUBLIC_KEY,
                    amount=winning_bid_amount
                )
                tx_url = f"https://explorer.solana.com/tx/{tx_id}?cluster=devnet"
                logger.info("Solana tx submitted: %s", tx_id)
            except Exception as e:
                # Don't fail the whole API if settlement fails; attach an error note and continue
                logger.error("Solana settlement failed: %s", e, exc_info=True)
                tx_id = None
                tx_url = None
                # Optionally include failure reason in response (not recommended for prod)
                result_dict.setdefault("settlement_error", str(e))
        else:
            logger.info("Skipping Solana settlement (missing keys or zero amount).")

        # 4) Attach tx info to winner + ranking items (non-destructive)
        if tx_id:
            winner_data["solana_tx_id"] = tx_id
            winner_data["solana_tx_url"] = tx_url

            for item in result_dict.get("ranking", []):
                if item.get("name") == winner_data.get("name"):
                    item["solana_tx_id"] = tx_id
                    item["solana_tx_url"] = tx_url
                    break

        # 5) Ensure result is valid for AuctionResult model and return
        return AuctionResult(**result_dict)

    except Exception as exc:
        logger.exception("Error running auction endpoint")
        raise HTTPException(status_code=500, detail=str(exc))
