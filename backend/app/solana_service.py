import asyncio
import random

async def settle_on_solana(
    from_secret_key: str, 
    to_public_key: str, 
    amount: int
) -> str:

    print(f"[MOCK SOLANA] Simulating transfer of ${amount} to {to_public_key}...")
        await asyncio.sleep(1) 
        fake_tx_id = f"MOCK_TX_{random.randint(100000000, 999999999)}"
    print(f"[MOCK SOLANA] Success! TX ID: {fake_tx_id}")
    
    return fake_tx_id
