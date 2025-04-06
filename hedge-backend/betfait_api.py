import os
import requests
import logging
from typing import Dict, List, Any
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class BetfairAPI:
    def __init__(self):
        # Load environment variables
        load_dotenv()

        # Betfair API Credentials
        self.username = os.getenv('BETFAIR_USERNAME')
        self.password = os.getenv('BETFAIR_PASSWORD')
        self.app_key = os.getenv('BETFAIR_APP_KEY')
        
        # Certificate paths
        self.cert_path = os.getenv('BETFAIR_CERT_PATH')
        self.key_path = os.getenv('BETFAIR_KEY_PATH')

        # Validate certificate paths
        if not os.path.exists(self.cert_path):
            logger.error(f"Certificate file not found: {self.cert_path}")
        if not os.path.exists(self.key_path):
            logger.error(f"Key file not found: {self.key_path}")

        # Betfair API endpoints
        self.login_endpoint = 'https://identitysso-cert.betfair.com/api/certlogin'
        self.exchange_endpoint = 'https://api.betfair.com/exchange/betting/json-rpc/v1'

        # Session token
        self.session_token = None

    def login(self) -> bool:
        """
        Authenticate with Betfair using certificate login
        """
        try:
            headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Application': self.app_key
            }
            
            payload = {
                'username': self.username,
                'password': self.password
            }

            # Use certificate for authentication
            response = requests.post(
                self.login_endpoint, 
                headers=headers, 
                data=payload,
                cert=(self.cert_path, self.key_path)
            )

            if response.status_code == 200:
                data = response.json()
                if data.get('loginStatus') == 'SUCCESS':
                    self.session_token = data.get('sessionToken')
                    logger.info('Successfully logged in to Betfair')
                    return True
                else:
                    logger.error(f'Login failed: {data}')
                    return False
            else:
                logger.error(f'Login request failed: Status {response.status_code}, Response: {response.text}')
                return False
        except Exception as e:
            logger.error(f'Login error: {e}')
            return False

    def list_live_markets(self, event_type_id: str = '1') -> List[Dict[str, Any]]:
        """
        Fetch live markets for a specific sport
        
        Event Type IDs:
        1 = Soccer
        2 = Tennis
        4 = Rugby Union
        7 = Cricket
        """
        if not self.session_token:
            if not self.login():
                return []

        try:
            # Betfair API request for live markets
            request_body = {
                "jsonrpc": "2.0",
                "method": "SportsAPING/v1.0/listMarketCatalogue",
                "params": {
                    "filter": {
                        "eventTypeIds": [event_type_id],
                        "marketTypeCodes": ["MATCH_ODDS"],
                        "inPlay": True
                    },
                    "maxResults": "100",
                    "marketProjection": [
                        "COMPETITION", 
                        "EVENT", 
                        "EVENT_TYPE", 
                        "MARKET_START_TIME"
                    ]
                },
                "id": 1
            }

            headers = {
                'X-Application': self.app_key,
                'X-Authentication': self.session_token,
                'Content-Type': 'application/json'
            }

            response = requests.post(
                self.exchange_endpoint, 
                json=request_body, 
                headers=headers,
                cert=(self.cert_path, self.key_path)
            )

            if response.status_code == 200:
                data = response.json()
                markets = data.get('result', [])
                
                # Transform markets into a more usable format
                formatted_markets = []
                for market in markets:
                    formatted_markets.append({
                        'market_id': market.get('marketId'),
                        'market_name': market.get('marketName'),
                        'competition': market.get('competition', {}).get('name', 'Unknown'),
                        'event_name': market.get('event', {}).get('name', 'Unknown'),
                        'start_time': market.get('marketStartTime')
                    })
                
                return formatted_markets
            else:
                logger.error(f'Market listing failed: Status {response.status_code}, Response: {response.text}')
                return []
        except Exception as e:
            logger.error(f'Error fetching live markets: {e}')
            return []

    def get_market_odds(self, market_id: str) -> Dict[str, Any]:
        """
        Fetch odds for a specific market
        """
        if not self.session_token:
            if not self.login():
                return {}

        try:
            request_body = {
                "jsonrpc": "2.0",
                "method": "SportsAPING/v1.0/listMarketBook",
                "params": {
                    "marketIds": [market_id],
                    "priceProjection": {
                        "priceData": ["EX_BEST_OFFERS"]
                    }
                },
                "id": 1
            }

            headers = {
                'X-Application': self.app_key,
                'X-Authentication': self.session_token,
                'Content-Type': 'application/json'
            }

            response = requests.post(
                self.exchange_endpoint, 
                json=request_body, 
                headers=headers,
                cert=(self.cert_path, self.key_path)
            )

            if response.status_code == 200:
                data = response.json()
                market_books = data.get('result', [])
                
                if market_books:
                    market_book = market_books[0]
                    runners = market_book.get('runners', [])
                    
                    # Extract best back and lay prices
                    formatted_runners = []
                    for runner in runners:
                        best_back = runner.get('ex', {}).get('availableToBack', [{}])[0].get('price', 0)
                        best_lay = runner.get('ex', {}).get('availableToLay', [{}])[0].get('price', 0)
                        
                        formatted_runners.append({
                            'selection_id': runner.get('selectionId'),
                            'runner_name': runner.get('runnerName'),
                            'best_back_price': best_back,
                            'best_lay_price': best_lay
                        })
                    
                    return {
                        'market_id': market_id,
                        'runners': formatted_runners
                    }
                
                return {}
            else:
                logger.error(f'Market odds fetch failed: Status {response.status_code}, Response: {response.text}')
                return {}
        except Exception as e:
            logger.error(f'Error fetching market odds: {e}')
            return {}
