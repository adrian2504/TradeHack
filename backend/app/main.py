# backend/app/main.py

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import json
import os

from .database import engine  # kept so tables are created
from . import sql_models

# -------------------------------------------------------------------
# FastAPI app + CORS
# -------------------------------------------------------------------

app = FastAPI()

# Allow frontend (Next.js) to call this backend
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create tables if needed (Supabase already has schema, but harmless)
sql_models.Base.metadata.create_all(bind=engine)


# -------------------------------------------------------------------
# Health check
# -------------------------------------------------------------------

@app.get("/health")
def health_check():
    return {"status": "ok"}


# -------------------------------------------------------------------
# New: expose agent JSON updated by Gemini
# This reads backend/edge_input.json and maps it to AgentProfile[]
# -------------------------------------------------------------------

@app.get("/api/v1/agents")
def get_agents_from_edge_json():
    """
    Returns agents in the shape your frontend expects, based on edge_input.json.

    edge_input.json looks like:
    {
      "social_mode": "...",
      "final_winner": {...},
      "rounds": [
        {
          "round_index": 1,
          "ranking": [
            {
              "name": "Random Investor",
              "money_score": ...,
              "social_score": ...,
              "final_score": ...,
              "bid": ...,
              "social_reason": "..."
            },
            ...
          ]
        },
        ...
      ]
    }
    """

    # backend folder = one level above this file's directory
    base_dir = Path(__file__).resolve().parents[1]
    json_path = base_dir / "edge_input.json"

    if not json_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"edge_input.json not found at {json_path}",
        )

    try:
        data = json.loads(json_path.read_text())
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to read edge_input.json: {e}",
        )

    rounds = data.get("rounds", [])
    if rounds:
        # Use the latest (last) round ranking
        last_round = rounds[-1]
        ranking = last_round.get("ranking", [])
    else:
        ranking = []

    agents = []

    for idx, r in enumerate(ranking):
        name = r.get("name", f"Agent {idx+1}")
        bid = r.get("bid", 0.0)
        final_score = r.get("final_score", 0.0)
        social_score = r.get("social_score", 0.0)

        # Helper: initials from name
        initials = "".join(part[0] for part in name.split() if part).upper() or "A"

        # Map to frontend AgentProfile shape
        agent = {
            "id": f"agent-{idx+1}",
            "name": name,
            "avatarInitials": initials,
            "affiliation": "AI Agent",
            "donationAmount": float(bid),
            # Map scores to 0–100 style; tweak as needed
            "philanthropyScore": int(social_score * 100),
            "socialImpactScore": int(social_score * 100),
            "fairnessScore": 50,          # placeholder; you can wire real fairness here
            "compositeScore": round(final_score * 100, 2),
            "strategy": "agent",
        }
        agents.append(agent)

    return {
        "agents": agents,
        "raw": data,  # optional: lets you inspect full JSON from frontend if needed
    }
