import os
import json
import asyncio
from solana.rpc.api import Client
from solders.pubkey import Pubkey
from solders.keypair import Keypair 
from solders.system_program import TransferParams, transfer
from solders.transaction import Transaction 
from solders.message import Message

import http.client

# This is the public address for the free devnet
SOLANA_CLUSTER_URL = "https://api.devnet.solana.com"

# Load your wallet keys from the .env file
PROJECT_WALLET_PUBKEY = os.getenv("YOUR_PROJECT_WALLET_PUBLIC_KEY_HERE")
WINNER_SECRET_KEY_STR = os.getenv("YOUR_HARDCODED_WINNER_SECRET_KEY_FOR_DEMO")

# Key Loading

# 1 SOL = 1 Billion Lamports
LAMPORTS_PER_SOL = 1_000_000_000

async def settle_on_solana(
    from_secret_key_str: str,  # The string "[...]"
    to_public_key_str: str,    # The string "..."
    amount_usd: int           # The winning bid, e.g., 100000
) -> str:
    """
    Executes a real transaction on the Solana devnet.
    'amount_usd' is the bid amount in USD.
    """

    # Mock Price Conversion 
    # For this hackathon, pretend 1 SOL = $10_000_000 USD
    sol_amount = float(amount_usd) / 10000000.0 
    lamports_to_send = int(sol_amount * LAMPORTS_PER_SOL)

    if lamports_to_send <= 0:
        print(f"Bid of ${amount_usd} is too small to send. Skipping transaction.")
        return "bid_too_small"

    # -Load Keys & Client ---
    try:
        # Load the 64-number array from the .env string
        full_keypair_list = json.loads(from_secret_key_str)
        
        # Convert the list to a 64-byte sequence
        full_keypair_bytes = bytes(full_keypair_list)

        sender_keypair = Keypair.from_bytes(full_keypair_bytes)
        
        # Load the receiver's wallet from their public key
        to_pubkey = Pubkey.from_string(to_public_key_str) # <--- THIS IS THE FIX

        # Connect to the devnet
        http_client = Client(SOLANA_CLUSTER_URL)
    except Exception as e:
        print(f"Error initializing Solana keys or client: {e}")
        raise e

# Build and Send Transaction
    try:
        # This is the helper function that contains all blocking calls
        def send_blocking_tx(client: Client, sender: Keypair, to_key: Pubkey, amount_lamports: int):
            
            # Get recent blockhash (blocking call)
            blockhash_resp = client.get_latest_blockhash()
            recent_blockhash = blockhash_resp.value.blockhash

            # Create the transfer instruction
            transfer_instruction = transfer(
                TransferParams(
                    from_pubkey=sender.pubkey(), 
                    to_pubkey=to_key,
                    lamports=amount_lamports
                )
            )

            # Create the final signed transaction
            txn = Transaction.new_signed_with_payer(
                instructions=[transfer_instruction],
                payer=sender.pubkey(),            
                signing_keypairs=[sender],        
                recent_blockhash=recent_blockhash
            )

            # Send the transaction (blocking call)
            print(f"Preparing to send {amount_lamports} lamports from {sender.pubkey()} to {to_key}...")
            print(f"Using blockhash: {recent_blockhash}")
            response = client.send_transaction(txn)
            return response.value # This is the transaction signature

        # Run our helper function in the async executor
        loop = asyncio.get_event_loop()
        
        tx_id = await loop.run_in_executor(
            None,  # Use the default thread pool
            send_blocking_tx, # The function to run
            http_client,      
            sender_keypair,   
            to_pubkey,        
            lamports_to_send  
        )
        
        print(f"Success! Transaction ID: {tx_id}")
        return str(tx_id)

    except Exception as e:
        print(f"Error sending Solana transaction: {e}")
        # This will send a 500 error to the frontend
        raise e