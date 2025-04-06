from fastapi import APIRouter, Query, HTTPException, BackgroundTasks
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import asyncio

from hedge_type_analyzer import HedgeType, EnhancedHedgeOpportunity
from hedge_strategy_manager import HedgeStrategyManager

# Create a router for hedge-related endpoints
router = APIRouter(prefix="/api/hedge")

# Initialize the hedge strategy manager
# This would typically be done in the main application file and passed to the router
# hedge_manager = HedgeStrategyManager(betfair_api, smarkets_api, odds_api, market_matcher)

# Placeholder for the hedge manager to be assigned later
hedge_manager = None

def set_hedge_manager(manager: HedgeStrategyManager):
    """Set the hedge manager instance for the router"""
    global hedge_manager
    hedge_manager = manager

# Pydantic models
class HedgeRequest(BaseModel):
    stake: float = 100.0
    min_profit_percentage: float = 0.5
    include_exchange_internal: bool = True
    include_cross_exchange: bool = True
    include_bookmaker_exchange: bool = True
    include_bookmaker_bookmaker: bool = False
    include_multi_leg: bool = False
    competitions: Optional[List[str]] = None
    max_results: int = 20

class HedgeExecuteRequest(BaseModel):
    opportunity_id: str
    validated: bool = False
    
class HedgeResponse(BaseModel):
    opportunities: List[Dict[str, Any]]
    total_count: int
    request_params: Dict[str, Any]

class ExecutionResponse(BaseModel):
    execution_id: str
    status: str
    details: Dict[str, Any]

class ValidationResponse(BaseModel):
    valid: bool
    details: Dict[str, Any]

@router.get("/status")
async def get_hedge_status():
    """Get status of the hedge system"""
    if not hedge_manager:
        raise HTTPException(status_code=503, detail="Hedge manager not initialized")
    
    return {
        "status": "healthy",
        "platforms": {
            "betfair": hedge_manager.betfair.check_connection(),
            "smarkets": hedge_manager.smarkets.test_connection(),
            "odds_api": hedge_manager.odds_api.check_connection()
        },
        "cache_status": {
            "betfair_markets": len(hedge_manager.odds_cache.get("betfair", {})),
            "smarkets_markets": len(hedge_manager.odds_cache.get("smarkets", {})),
            "oddsapi_markets": len(hedge_manager.odds_cache.get("oddsapi", {}))
        }
    }

@router.post("/find-opportunities", response_model=HedgeResponse)
async def find_hedge_opportunities(request: HedgeRequest):
    """Find hedge opportunities across all platforms and hedge types"""
    if not hedge_manager:
        raise HTTPException(status_code=503, detail="Hedge manager not initialized")
    
    try:
        # Find optimal hedge opportunities
        opportunities = await hedge_manager.find_optimal_hedge_opportunities(
            stake=request.stake,
            min_profit_percentage=request.min_profit_percentage,
            competition_filter=request.competitions,
            refresh_cache=True
        )
        
        # Filter by hedge type if specified
        filtered_opportunities = []
        for op in opportunities:
            if (op.hedge_type == HedgeType.EXCHANGE_INTERNAL and request.include_exchange_internal) or \
               (op.hedge_type == HedgeType.CROSS_EXCHANGE and request.include_cross_exchange) or \
               (op.hedge_type == HedgeType.BOOKMAKER_EXCHANGE and request.include_bookmaker_exchange) or \
               (op.hedge_type == HedgeType.BOOKMAKER_BOOKMAKER and request.include_bookmaker_bookmaker) or \
               (op.hedge_type == HedgeType.MULTI_LEG and request.include_multi_leg):
                filtered_opportunities.append(op)
        
        # Limit results if needed
        if request.max_results > 0:
            filtered_opportunities = filtered_opportunities[:request.max_results]
        
        # Convert to response format
        response_opportunities = []
        for i, op in enumerate(filtered_opportunities):
            response_opportunities.append({
                "id": f"op_{i}",
                "event_name": op.event_name,
                "runner_name": op.runner_name,
                "hedge_type": op.hedge_type.value,
                "back_exchange": op.back_exchange,
                "lay_exchange": op.lay_exchange,
                "back_odds": op.back_odds,
                "lay_odds": op.lay_odds,
                "stake": op.stake,
                "lay_stake": op.lay_stake,
                "profit": op.profit,
                "profit_percentage": op.profit_percentage,
                "leg_count": op.leg_count,
                "is_multi_leg": op.is_multi_leg,
                "back_platform": op.back_platform,
                "lay_platform": op.lay_platform,
                "instructions": f"Place £{op.stake:.2f} back bet on {op.runner_name} at {op.back_exchange} with odds of {op.back_odds:.2f}, and £{op.lay_stake:.2f} lay bet at {op.lay_exchange} with odds of {op.lay_odds:.2f}"
            })
        
        return {
            "opportunities": response_opportunities,
            "total_count": len(filtered_opportunities),
            "request_params": {
                "stake": request.stake,
                "min_profit_percentage": request.min_profit_percentage,
                "hedge_types_included": {
                    "exchange_internal": request.include_exchange_internal,
                    "cross_exchange": request.include_cross_exchange,
                    "bookmaker_exchange": request.include_bookmaker_exchange,
                    "bookmaker_bookmaker": request.include_bookmaker_bookmaker,
                    "multi_leg": request.include_multi_leg
                }
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error finding hedge opportunities: {str(e)}")

@router.post("/validate-opportunity", response_model=ValidationResponse)
async def validate_hedge_opportunity(opportunity_id: str):
    """Validate a hedge opportunity by checking current odds"""
    if not hedge_manager:
        raise HTTPException(status_code=503, detail="Hedge manager not initialized")
    
    try:
        # In a real implementation, you would retrieve the opportunity from a database
        # or cache using the opportunity_id
        
        # For demonstration, we'll just return a mock response
        return {
            "valid": True,
            "details": {
                "current_profit": 5.25,
                "current_profit_percentage": 5.25,
                "original_profit": 5.75,
                "original_profit_percentage": 5.75,
                "message": "Opportunity still valid but profit has decreased slightly"
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error validating hedge opportunity: {str(e)}")

@router.post("/execute", response_model=ExecutionResponse)
async def execute_hedge_opportunity(request: HedgeExecuteRequest, background_tasks: BackgroundTasks):
    """Execute a hedge opportunity"""
    if not hedge_manager:
        raise HTTPException(status_code=503, detail="Hedge manager not initialized")
    
    try:
        # In a real implementation, you would retrieve the opportunity from a database
        # or cache using the opportunity_id
        
        # If validation is required, check current odds first
        if request.validated:
            validation_result = await validate_hedge_opportunity(request.opportunity_id)
            if not validation_result["valid"]:
                raise HTTPException(status_code=400, detail="Opportunity is no longer valid")
        
        # For demonstration, we'll just return a mock response
        execution_id = f"exec_{request.opportunity_id}_{int(asyncio.get_event_loop().time())}"
        
        # In a real implementation, you would execute the hedge in the background
        background_tasks.add_task(execute_in_background, execution_id)
        
        return {
            "execution_id": execution_id,
            "status": "in_progress",
            "details": {
                "opportunity_id": request.opportunity_id,
                "message": "Hedge execution started in the background",
                "timestamp": asyncio.get_event_loop().time()
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error executing hedge opportunity: {str(e)}")

@router.get("/execution-status/{execution_id}", response_model=Dict[str, Any])
async def get_execution_status(execution_id: str):
    """Get the status of a hedge execution"""
    if not hedge_manager:
        raise HTTPException(status_code=503, detail="Hedge manager not initialized")
    
    try:
        status = hedge_manager.get_execution_status(execution_id)
        if not status.get("found", False):
            raise HTTPException(status_code=404, detail="Execution ID not found")
        
        return status
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting execution status: {str(e)}")

async def execute_in_background(execution_id: str):
    """Background task for executing a hedge"""
    # This is where you would call the hedge manager's execute_hedge_bet method
    # with the opportunity corresponding to the opportunity_id
    await asyncio.sleep(2)  # Simulate execution time
    
    # In a real implementation, you would update the execution status in the database
    # For demonstration, we'll just log a message
    print(f"Hedge execution {execution_id} completed")

# Function to integrate with your main enhanced_backend.py
def include_hedge_router(app, betfair_api, smarkets_api, odds_api, market_matcher):
    """
    Include the hedge router in the main FastAPI app
    
    Args:
        app: The FastAPI app instance
        betfair_api: Initialized BetfairAPI instance
        smarkets_api: Initialized SmarketsAPI instance
        odds_api: Initialized OddsAPIClient instance
        market_matcher: Initialized MarketMatcher instance
    """
    # Initialize the hedge manager
    hedge_manager = HedgeStrategyManager(betfair_api, smarkets_api, odds_api, market_matcher)
    
    # Set the hedge manager for the router
    set_hedge_manager(hedge_manager)
    
    # Include the router in the app
    app.include_router(router)
    
    return hedge_manager
