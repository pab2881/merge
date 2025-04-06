import os
import requests
import logging
import time
from typing import Dict, List, Any
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/betfair_odds.log'),  # Dedicated log file for odds
        logging.StreamHandler()  # Also output to console
    ]
)
logger = logging.getLogger(__name__)

class BetfairAPI:
    """Class to interact with the Betfair Exchange API for fetching markets and odds."""

    def __init__(self):
        """Initialize with credentials from .env and API endpoints."""
        load_dotenv()
        self.username = os.getenv('BETFAIR_USERNAME')
        self.password = os.getenv('BETFAIR_PASSWORD')
        self.app_key = os.getenv('BETFAIR_APP_KEY')
        self.cert_path = os.getenv('BETFAIR_CERT_PATH')
        self.key_path = os.getenv('BETFAIR_KEY_PATH')
        self._validate_credentials()
        self.login_endpoint = 'https://identitysso-cert.betfair.com/api/certlogin'
        self.exchange_endpoint = 'https://api.betfair.com/exchange/betting/json-rpc/v1'
        self.session_token = None

    def _validate_credentials(self):
        """Check if credentials and certificate files are present."""
        if not all([self.username, self.password, self.app_key]):
            logger.error("Missing Betfair credentials in .env")
            raise ValueError("Betfair credentials (username, password, app_key) must be set in .env")
        if not os.path.exists(self.cert_path):
            logger.error(f"Certificate file not found: {self.cert_path}")
            raise FileNotFoundError(f"Certificate file missing: {self.cert_path}")
        if not os.path.exists(self.key_path):
            logger.error(f"Key file not found: {self.key_path}")
            raise FileNotFoundError(f"Key file missing: {self.key_path}")

    def login(self) -> bool:
        """Authenticate with Betfair and obtain a session token."""
        try:
            headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Application': self.app_key
            }
            payload = {
                'username': self.username,
                'password': self.password
            }
            response = requests.post(
                self.login_endpoint,
                headers=headers,
                data=payload,
                cert=(self.cert_path, self.key_path)
            )
            response.raise_for_status()
            data = response.json()
            if data.get('loginStatus') == 'SUCCESS':
                self.session_token = data.get('sessionToken')
                logger.info("Successfully logged in to Betfair")
                return True
            else:
                logger.error(f"Login failed: {data.get('loginStatus')}")
                return False
        except requests.RequestException as e:
            logger.error(f"Login request failed: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected login error: {e}")
            return False

    def list_live_markets(self, event_type_id: str = '1') -> List[Dict[str, Any]]:
        """Fetch up to 100 live British football Match Odds markets."""
        if not self.session_token and not self.login():
            return []
        try:
            request_body = {
                "jsonrpc": "2.0",
                "method": "SportsAPING/v1.0/listMarketCatalogue",
                "params": {
                    "filter": {
                        "eventTypeIds": [event_type_id],  # Soccer
                        "marketTypeCodes": ["MATCH_ODDS"],
                        "inPlay": True,  # Live markets
                        "competitionIds": ["31", "33", "35", "37"]  # Premier League, Championship, League 1, League 2
                    },
                    "maxResults": "100",
                    "marketProjection": ["COMPETITION", "EVENT", "EVENT_TYPE", "MARKET_START_TIME", "RUNNER_DESCRIPTION"]
                },
                "id": 1
            }
            headers = {
                'X-Application': self.app_key,
                'X-Authentication': self.session_token,
                'Content-Type': 'application/json'
            }
            response = requests.post(self.exchange_endpoint, json=request_body, headers=headers, cert=(self.cert_path, self.key_path))
            response.raise_for_status()
            data = response.json()
            markets = data.get('result', [])
            formatted_markets = [
                {
                    'market_id': market.get('marketId'),
                    'market_name': market.get('marketName'),
                    'competition': market.get('competition', {}).get('name', 'Unknown'),
                    'event_name': market.get('event', {}).get('name', 'Unknown'),
                    'start_time': market.get('marketStartTime'),
                    'runners': {runner['selectionId']: runner['runnerName'] for runner in market.get('runners', [])}
                }
                for market in markets
                if 'test' not in market.get('event', {}).get('name', 'Unknown').lower() and 
                   'unknown' not in market.get('competition', {}).get('name', 'Unknown').lower()
            ]
            logger.info(f"Fetched {len(formatted_markets)} live British football markets")
            return formatted_markets
        except requests.RequestException as e:
            logger.error(f"Failed to fetch markets: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error fetching markets: {e}")
            return []

    def get_market_odds(self, market_id: str) -> Dict[str, Any]:
        """Fetch and log live odds for a specific market."""
        if not self.session_token and not self.login():
            logger.error("Login required for odds fetch")
            return {'detail': 'Login failed'}
        try:
            logger.info(f"Fetching odds for market {market_id}")
            request_body = {
                "jsonrpc": "2.0",
                "method": "SportsAPING/v1.0/listMarketBook",
                "params": {
                    "marketIds": [market_id],
                    "priceProjection": {"priceData": ["EX_BEST_OFFERS"]}
                },
                "id": 1
            }
            headers = {
                'X-Application': self.app_key,
                'X-Authentication': self.session_token,
                'Content-Type': 'application/json'
            }
            time.sleep(1)  # Respect Betfair rate limits
            response = requests.post(self.exchange_endpoint, json=request_body, headers=headers, cert=(self.cert_path, self.key_path))
            response.raise_for_status()
            data = response.json()
            market_books = data.get('result', [])
            if not market_books:
                logger.warning(f"No odds data for market {market_id}")
                return {'detail': 'No market data'}
            market_book = market_books[0]
            runners = market_book.get('runners', [])
            formatted_runners = [
                {
                    'selection_id': runner.get('selectionId'),
                    'runner_name': self._get_runner_name(market_id, runner.get('selectionId')),
                    'back_odds': runner.get('ex', {}).get('availableToBack', [{}])[0].get('price', 0),
                    'lay_odds': runner.get('ex', {}).get('availableToLay', [{}])[0].get('price', 0)
                }
                for runner in runners
            ]
            # Log live odds for each runner
            for runner in formatted_runners:
                logger.info(
                    f"Live Odds - Market: {market_id}, Runner: {runner['runner_name']}, "
                    f"Back: {runner['back_odds']}, Lay: {runner['lay_odds']}"
                )
            return {'market_id': market_id, 'runners': formatted_runners}
        except requests.RequestException as e:
            logger.error(f"Failed to fetch odds for market {market_id}: {e}")
            return {'detail': str(e)}
        except Exception as e:
            logger.error(f"Unexpected error fetching odds for market {market_id}: {e}")
            return {'detail': str(e)}

    def _get_runner_name(self, market_id: str, selection_id: int) -> str:
        """Retrieve runner name from cached market data."""
        markets = self.list_live_markets()
        for market in markets:
            if market['market_id'] == market_id:
                return market['runners'].get(selection_id, str(selection_id))
        logger.warning(f"Runner name not found for selection {selection_id} in market {market_id}")
        return str(selection_id)
