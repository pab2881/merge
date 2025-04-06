import time
from betfair_api import BetfairAPI

bf = BetfairAPI()
market_id = "1.241487171"  # Switch to live market

def poll_odds(market_id):
    earliest = None
    while True:
        latest = bf.get_market_odds(market_id)
        print(f"Formatted odds:\n{latest}")
        if 'runners' in latest and earliest and 'runners' in earliest:
            for l_runner, e_runner in zip(latest["runners"], earliest["runners"]):
                print(f"Runner: {l_runner['runner_name']}, Latest: {l_runner['best_back_price']}/{l_runner['best_lay_price']}, Earliest: {e_runner['best_back_price']}/{e_runner['best_lay_price']}")
        earliest = latest
        time.sleep(30)

if __name__ == "__main__":
    poll_odds(market_id)
