# backend/app/solana_service.py (stub for dev)
import asyncio
import uuid

async def settle_on_solana(from_secret_key: str, to_public_key: str, amount: float) -> str:
    # Simulate network delay and return a fake tx id for dev
    await asyncio.sleep(0.5)
    return "DEV_TX_" + uuid.uuid4().hex
