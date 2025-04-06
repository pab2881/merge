# live_odds_logger.py
import time
from betfair_api import BetfairAPI

# Initialize Betfair API
betfair = BetfairAPI()

def log_live_odds():
    # Fetch initial markets (up to 100)
    markets = betfair.list_live_markets()
    if not markets:
        print("No markets found.")
        return

    market_ids = [market['market_id'] for market in markets]
    print(f"Tracking {len(market_ids)} markets: {market_ids}")

    # Poll indefinitely
    while True:
        for market_id in market_ids:
            betfair.get_market_odds(market_id)  # Logs odds to general.log
        time.sleep(10)  # Poll every 10 seconds (adjustable)

if __name__ == "__main__":
    log_live_odds()
