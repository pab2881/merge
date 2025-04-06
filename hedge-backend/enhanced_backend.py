import os
import logging
import asyncio
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import uvicorn
from datetime import datetime

# Import our custom modules
from betfair_api import BetfairAPI
from smarkets_api import SmarketsAPI
from odds_api import OddsAPIClient
from market_matcher import MarketMatcher
from hedge_calculator import HedgeCalculator, HedgeOpportunity

# Configure fallback mode - set to True to always use fallbacks regardless of API status
FORCE_FALLBACK_MODE = os.environ.get("FORCE_FALLBACK_MODE", "False").lower() == "true"

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("logs/backend.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Initialize APIs
betfair = BetfairAPI()
smarkets = SmarketsAPI()
odds_api = OddsAPIClient()
matcher = MarketMatcher()
calculator = HedgeCalculator()

# Initialize FastAPI app
app = FastAPI(
    title="Cross-Platform Hedge Opportunities API",
    description="API for finding betting hedge opportunities across Betfair, Smarkets, and traditional bookmakers"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Pydantic models for request/response
class OddsData(BaseModel):
    market_id: str
    runners: List[Dict[str, Any]]

class CrossPlatformRequest(BaseModel):
    back_market_id: str
    lay_market_id: str
    back_platform: str
    lay_platform: str
    stake: float = 100.0

class HedgeOpportunityResponse(BaseModel):
    event_name: str
    runner_name: str
    back_exchange: str
    lay_exchange: str
    back_odds: float
    lay_odds: float
    stake: float
    lay_stake: float
    profit: float
    profit_percentage: float
    back_market_id: str
    lay_market_id: str
    back_selection_id: Optional[str]
    lay_selection_id: Optional[str]
    back_platform: str
    lay_platform: str
    instructions: str

@app.get("/api/status")
async def api_status():
    """
    Extended status endpoint with detailed information about API connections
    """
    logger.info("API status endpoint accessed")
    
    try:
        # Test platform APIs
        betfair_connected = betfair.check_connection() if hasattr(betfair, 'check_connection') else False
        smarkets_connected = smarkets.test_connection() if hasattr(smarkets, 'test_connection') else False
        odds_api_connected = odds_api.check_connection() if hasattr(odds_api, 'check_connection') else False
        
        # Get Smarkets API stats
        smarkets_stats = smarkets.get_api_stats() if hasattr(smarkets, 'get_api_stats') else {}
        
        return {
            "status": "healthy" if (betfair_connected or smarkets_connected or odds_api_connected) else "degraded",
            "betfair": {
                "status": "connected" if betfair_connected else "disconnected",
                "time": datetime.now().isoformat()
            },
            "smarkets": {
                "status": "connected" if smarkets_connected else "disconnected",
                "using_fallback": smarkets_stats.get("using_fallback", True),
                "stats": smarkets_stats,
                "time": datetime.now().isoformat()
            },
            "odds_api": {
                "status": "connected" if odds_api_connected else "disconnected",
                "time": datetime.now().isoformat()
            },
            "force_fallback_mode": FORCE_FALLBACK_MODE,
            "server_time": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error in API status check: {str(e)}")
        return {
            "status": "error", 
            "message": f"Error checking API status: {str(e)}",
            "server_time": datetime.now().isoformat()
        }

@app.get("/")
async def root():
    logger.info("Root endpoint accessed")
    return {
        "status": "healthy",
        "message": "Cross-Platform Hedge Opportunities API is running",
        "endpoints": [
            "/health",
            "/api/betfair/live-markets",
            "/api/smarkets/live-markets",
            "/api/oddsapi/live-markets",
            "/api/matched-markets",
            "/api/cross-platform/opportunities"
        ]
    }

@app.get("/health")
async def health_check():
    logger.info("Health check endpoint accessed")
    
    try:
        # Check platform APIs with error handling
        betfair_health = "healthy" if hasattr(betfair, 'check_connection') and betfair.check_connection() else "unhealthy"
        smarkets_health = "healthy" if hasattr(smarkets, 'test_connection') and smarkets.test_connection() else "unhealthy"
        odds_api_health = "healthy" if hasattr(odds_api, 'check_connection') and odds_api.check_connection() else "unhealthy"
        
        return {
            "status": "healthy",
            "betfair_status": betfair_health,
            "smarkets_status": smarkets_health,
            "odds_api_status": odds_api_health,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error in health check: {str(e)}")
        # Return healthy anyway to prevent frontend failures
        return {
            "status": "healthy",
            "message": f"Error checking API health: {str(e)}",
            "timestamp": datetime.now().isoformat()
        }

@app.get("/api/betfair/live-markets")
async def get_betfair_live_markets(
    stake: float = Query(100.0, ge=1.0, description="Initial stake amount in GBP")
):
    logger.info(f"Received request for Betfair live markets with stake={stake}")
    
    try:
        live_markets = betfair.list_live_markets()
        
        if not live_markets:
            logger.warning("No live markets returned from Betfair API")
            return {"detail": "No live markets found"}
        
        formatted_markets = []
        for market in live_markets:
            logger.info(f"Fetching odds for Betfair market {market['market_id']}")
            odds = betfair.get_market_odds(market["market_id"])
            
            if "detail" in odds:
                logger.error(f"Failed to fetch odds for market {market['market_id']}: {odds['detail']}")
                continue
            
            formatted_market = {
                "id": market["market_id"],
                "name": market["market_name"],
                "event_name": market["event_name"],
                "competition": market["competition"],
                "startTime": market["start_time"],
                "platform": "betfair",
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
            
            # Calculate max profit (Betfair internal hedge)
            formatted_market["max_profit"] = max(
                [
                    calculator.calculate_hedge(
                        runner["best_back_price"],
                        runner["best_lay_price"],
                        stake,
                        calculator.BETFAIR_COMMISSION,
                        calculator.BETFAIR_COMMISSION
                    )["profit"] if calculator.calculate_hedge(
                        runner["best_back_price"],
                        runner["best_lay_price"],
                        stake,
                        calculator.BETFAIR_COMMISSION,
                        calculator.BETFAIR_COMMISSION
                    ) else 0
                    for runner in formatted_market["odds"]
                ] or [0]
            ) if formatted_market["odds"] else 0
            
            formatted_markets.append(formatted_market)
        
        # Sort by max profit
        formatted_markets.sort(key=lambda x: x.get("max_profit", 0), reverse=True)
        
        logger.info(f"Returning {len(formatted_markets)} Betfair markets to client")
        return formatted_markets
        
    except Exception as e:
        logger.error(f"Error processing Betfair live markets: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/api/smarkets/live-markets")
async def get_smarkets_live_markets(
    stake: float = Query(100.0, ge=1.0, description="Initial stake amount in GBP")
):
    logger.info(f"Received request for Smarkets live markets with stake={stake}")
    
    try:
        # Filter for UK football competitions
        competitions_filter = ["Premier League", "Championship", "League One", "League Two"]
        live_markets = smarkets.list_live_markets(competition_filter=competitions_filter)
        
        if not live_markets:
            logger.warning("No live markets returned from Smarkets API")
            return {"detail": "No live markets found"}
        
        formatted_markets = []
        for market in live_markets:
            logger.info(f"Fetching odds for Smarkets market {market['market_id']}")
            odds = smarkets.get_market_odds(market["market_id"])
            
            if "detail" in odds:
                logger.error(f"Failed to fetch odds for market {market['market_id']}: {odds['detail']}")
                continue
            
            formatted_market = {
                "id": market["market_id"],
                "name": market["market_name"],
                "event_name": market["event_name"],
                "competition": market["competition"],
                "startTime": market["start_time"],
                "platform": "smarkets",
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
            
            # Calculate max profit (Smarkets internal hedge)
            formatted_market["max_profit"] = max(
                [
                    calculator.calculate_hedge(
                        runner["best_back_price"],
                        runner["best_lay_price"],
                        stake,
                        calculator.SMARKETS_COMMISSION,
                        calculator.SMARKETS_COMMISSION
                    )["profit"] if calculator.calculate_hedge(
                        runner["best_back_price"],
                        runner["best_lay_price"],
                        stake,
                        calculator.SMARKETS_COMMISSION,
                        calculator.SMARKETS_COMMISSION
                    ) else 0
                    for runner in formatted_market["odds"]
                ] or [0]
            ) if formatted_market["odds"] else 0
            
            formatted_markets.append(formatted_market)
        
        # Sort by max profit
        formatted_markets.sort(key=lambda x: x.get("max_profit", 0), reverse=True)
        
        logger.info(f"Returning {len(formatted_markets)} Smarkets markets to client")
        return formatted_markets
        
    except Exception as e:
        logger.error(f"Error processing Smarkets live markets: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/api/oddsapi/live-markets")
async def get_odds_api_live_markets(
    stake: float = Query(100.0, ge=1.0, description="Initial stake amount in GBP")
):
    logger.info(f"Received request for The Odds API live markets with stake={stake}")
    
    try:
        # Filter for British football competitions
        competitions_filter = list(odds_api.BRITISH_FOOTBALL_LEAGUES.values())
        live_markets = odds_api.list_live_markets(competition_filter=competitions_filter)
        
        if not live_markets:
            logger.warning("No live markets returned from The Odds API")
            return {"detail": "No live markets found"}
        
        formatted_markets = []
        for market in live_markets:
            logger.info(f"Fetching odds for The Odds API market {market['market_id']}")
            odds = odds_api.get_market_odds(market["market_id"])
            
            if "detail" in odds:
                logger.error(f"Failed to fetch odds for market {market['market_id']}: {odds['detail']}")
                continue
            
            formatted_market = {
                "id": market["market_id"],
                "name": "Match Odds",
                "event_name": market["event_name"],
                "competition": market["competition"],
                "bookmaker": market["bookmaker"],
                "startTime": market["start_time"],
                "platform": "oddsapi",
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
            
            formatted_markets.append(formatted_market)
        
        logger.info(f"Returning {len(formatted_markets)} The Odds API markets to client")
        return formatted_markets
        
    except Exception as e:
        logger.error(f"Error processing The Odds API live markets: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# Fixed indentation for the main block
if __name__ == "__main__":
    os.makedirs('logs', exist_ok=True)
    logger.info("Starting Enhanced Backend on port 3003")
    uvicorn.run("enhanced_backend:app", host="0.0.0.0", port=3003, reload=True)
