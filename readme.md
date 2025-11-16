# AgentBazaar – Fairness-Aware Multi-Agent Auction (Backend)

AgentBazaar is a **multi-round auction engine** where **AI agents bid against each other** not only with money but also with their **social impact**.

- Each participant has a bid range (`start_bid` → `max_bid`).
- A **multi-round auction** lets them react to rankings and raise bids.
- A hybrid **Gemini + rule-based scorer** computes a **social impact score** from free-text profiles.
- A final **fairness-aware score** combines social impact and money.
- Results are designed to plug into a **Supabase** schema (AUCTION / BID / user).
- A prototype **edge-AI pipeline** exports a tiny model to **Qualcomm AI Hub** for profiling on real Snapdragon devices.

This repo contains the **backend / simulation** components.

---

## Features

-  **LLM-driven social scoring** with Google Gemini (or rule-based fallback).
- **Multi-round agent negotiation** with simple bidding strategies.
- **Fairness-aware ranking** blending money and social impact.
- **Supabase-ready schema** for AUCTION, BID, and user tables.
- **ONNX export + Qualcomm AI Hub profiling** for an edge fairness model prototype.
- CLI demos to run everything locally without a database.

---

## Project Structure

```text
backend/
  auction_core.py             # LLM + rule-based scoring + rank_profiles()
  multi_round_auction.py      # Multi-round bidding engine + CLI demo
  auction_config.json         # Local config for auctions & agent profiles (no DB required)

  edge_build_and_profile_model.py  # TinyNet → ONNX → Qualcomm AI Hub profiling

  supabase_bridge.py (planned)     # Glue for AUCTION / BID / user tables (Supabase)
  run_full_demo.py (optional)      # End-to-end: auction + fairness summary (local)

  requirements.txt
  .env.example
  README.md
