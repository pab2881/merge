import os
import logging
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
from betfair_api import BetfairAPI
import uvicorn

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/backend.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

betfair = BetfairAPI()

app = FastAPI(
    title="Hedge Opportunities API",
    description="API for finding betting hedge opportunities"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

class OddsData(BaseModel):
    market_id: str
    runners: List[Dict[str, Any]]

@app.get("/")
async def root():
    logger.info("Root endpoint accessed")
    return {
        "status": "healthy",
        "message": "Hedge Opportunities Backend is running",
        "endpoints": ["/api/betfair/live-markets", "/api/betfair/market-odds/{market_id}", "/api/hedge-opportunities"]
    }

@app.get("/health")
async def health_check():
    logger.info("Health check endpoint accessed")
    return {"status": "healthy"}

@app.get("/api/betfair/live-markets")
async def get_live_markets(stake: float = Query(100.0, ge=1.0, description="Initial stake amount in GBP")):
    logger.info(f"Received request for live markets with stake={stake}")
    try:
        live_markets = betfair.list_live_markets()
        if not live_markets:
            logger.warning("No live markets returned from Betfair API")
            return {"detail": "No live British football markets found"}

        formatted_markets = []
        for market in live_markets:
            logger.info(f"Fetching odds for market {market['market_id']}")
            odds = betfair.get_market_odds(market['market_id'])
            if 'detail' in odds:
                logger.error(f"Failed to fetch odds for market {market['market_id']}: {odds['detail']}")
                formatted_markets.append({
                    "id": market["market_id"],
                    "name": market["market_name"],
                    "event_name": market["event_name"],
                    "competition": market["competition"],
                    "startTime": market["start_time"],
                    "odds": [],
                    "error": odds["detail"]
                })
                continue

            formatted_market = {
                "id": market["market_id"],
                "name": market["market_name"],
                "event_name": market["event_name"],
                "competition": market["competition"],
                "startTime": market["start_time"],
                "odds": [
                    {
                        "selection_id": runner["selection_id"],
                        "runner_name": runner["runner_name"],
                        "best_back_price": runner["back_odds"],
                        "best_lay_price": runner["lay_odds"],
                        "status": "ACTIVE"
                    }
                    for runner in odds.get("runners", [])
                ]
            }
            formatted_market["max_profit"] = max(
                [calculate_estimated_profit(runner["best_back_price"], runner["best_lay_price"], stake) 
                 for runner in formatted_market["odds"]] or [0]
            ) if formatted_market["odds"] else 0
            formatted_markets.append(formatted_market)
            logger.info(f"Processed market {market['market_id']} with {len(formatted_market['odds'])} runners")

        formatted_markets.sort(key=lambda x: x.get("max_profit", 0), reverse=True)
        logger.info(f"Returning {len(formatted_markets)} markets to client")
        return formatted_markets
    except Exception as e:
        logger.error(f"Error processing live markets: {str(e)}")
        return {"detail": f"Internal server error: {str(e)}"}

@app.get("/api/betfair/market-odds/{market_id}")
async def get_market_odds(market_id: str):
    logger.info(f"Fetching odds for market {market_id}")
    odds = betfair.get_market_odds(market_id)
    if 'detail' in odds:
        logger.error(f"Failed to fetch odds for market {market_id}: {odds['detail']}")
        return {"detail": odds["detail"]}

    formatted_odds = {
        "market_id": odds["market_id"],
        "runners": [
            {
                "selection_id": runner["selection_id"],
                "runner_name": runner["runner_name"],
                "best_back_price": runner["back_odds"],
                "best_lay_price": runner["lay_odds"],
                "status": "ACTIVE"
            }
            for runner in odds.get("runners", [])
        ]
    }
    logger.info(f"Returning odds for market {market_id} with {len(formatted_odds['runners'])} runners")
    return formatted_odds

@app.post("/api/hedge-opportunities")
async def find_hedge_opportunities(odds: OddsData):
    logger.info(f"Calculating hedge opportunities for market {odds.market_id}")
    hedges = []
    for runner in odds.runners:
        back_odds = float(runner.get("best_back_price", 0))
        lay_odds = float(runner.get("best_lay_price", 0))
        stake = 100
        if back_odds > lay_odds > 0:
            back_payout = stake * back_odds
            lay_stake = back_payout / lay_odds
            lay_liability = (lay_odds - 1) * lay_stake
            profit_if_back_wins = back_payout - lay_liability
            profit_if_lay_wins = lay_stake - stake
            if profit_if_back_wins > 0 and profit_if_lay_wins > 0:
                hedges.append({
                    "runner": runner.get("runner_name", "Unknown"),
                    "back_odds": back_odds,
                    "lay_odds": lay_odds,
                    "stake": stake,
                    "lay_stake": round(lay_stake, 2),
                    "profit": round(min(profit_if_back_wins, profit_if_lay_wins), 2)
                })
    logger.info(f"Found {len(hedges)} hedge opportunities for market {odds.market_id}")
    return {"market_id": odds.market_id, "hedge_opportunities": hedges}

def calculate_estimated_profit(back_odds: float, lay_odds: float, stake: float) -> float:
    if back_odds <= 0 or lay_odds <= 0:
        return 0
    back_payout = stake * back_odds
    lay_stake = back_payout / lay_odds
    lay_liability = (lay_odds - 1) * lay_stake
    profit_if_back_wins = back_payout - lay_liability
    profit_if_lay_wins = lay_stake - stake
    return min(profit_if_back_wins, profit_if_lay_wins)

if __name__ == "__main__":
    os.makedirs('logs', exist_ok=True)
    logger.info("Starting Hedge Opportunities Backend on port 3002")
    uvicorn.run("backend_app:app", host="0.0.0.0", port=3002, reload=True)

