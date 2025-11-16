from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import os # <--- 1. Import os to read from .env

# Import your modules
from .database import get_db, engine
from . import sql_models
from . import auction_engine 
from . import solana_service # <--- 2. Import your solana service
# from . import api_models # (You may have this for Pydantic response models)

# This command creates the tables in your DB if they don't exist
# (Supabase already did this, but it's good practice)
sql_models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# Add CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", # Vite default
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/v1/run-auction/{auction_id}")
async def run_auction(
    auction_id: str, 
    db: Session = Depends(get_db) 
):
    """
    Main API endpoint to run the entire auction,
    including AI scoring and on-chain settlement.
    """
    
    try:
        # RUN AUCTION ENGINE 
        print(f"Running auction for: {auction_id}")
        result_dict = await auction_engine.run_auction_from_db(
            auction_id=auction_id,
            db=db
        )

        # PREPARE SOLANA SETTLEMENT -
        # Extract the winner's data from the engine's result
        if "winner" not in result_dict or not result_dict["winner"]:
            raise auction_engine.AuctionError("Auction engine failed to select a winner.")
            
        winner_data = result_dict["winner"]
        
        # Get the winning bid amount from the winner's profile
        # (This comes from the 'max_bid' key we created in the engine)
        winning_bid_amount_usd = winner_data["profile"]["max_bid"]
        
        # Get wallet keys from your .env file
        # The "FROM" wallet is the your hardcoded bidder wallet
        from_key = os.getenv("YOUR_HARDCODED_WINNER_SECRET_KEY_FOR_DEMO")
        # The "TO" wallet is the your project's wallet
        to_key = os.getenv("YOUR_PROJECT_WALLET_PUBLIC_KEY_HERE")

        if not from_key or not to_key:
            print("ERROR: Solana wallet keys not found in .env file.")
            raise HTTPException(status_code=500, detail="Server is missing Solana wallet configuration.")

        # EXECUTE SOLANA SETTLEMENT 
        print(f"Settling winning bid of ${winning_bid_amount_usd} on Solana...")
        tx_id = await solana_service.settle_on_solana(
            from_secret_key_str=from_key,
            to_public_key_str=to_key,
            amount_usd=winning_bid_amount_usd
        )
        
        tx_url = f"https://explorer.solana.com/tx/{tx_id}?cluster=devnet"
        print(f"Settlement successful: {tx_url}")

        # ADD PROOF TO RESPONSE 
        # Inject the Solana proof into the result object
        result_dict["winner"]["solana_tx_id"] = tx_id
        result_dict["winner"]["solana_tx_url"] = tx_url

        # UPDATE DB 
        # update the AUCTION table to 'COMPLETED'
        # db.query(sql_models.Auction).filter(...).update({"status": "COMPLETED"})
        # db.commit()

        # Return the final, combined result
        return result_dict

    except auction_engine.AuctionError as e:
        # This catches errors like "Auction not found"
        print(f"Auction Error: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        # This catches all other errors (Solana, Gemini, etc.)
        print(f"Unhandled Error during auction: {e}")
        raise HTTPException(status_code=500, detail=str(e))