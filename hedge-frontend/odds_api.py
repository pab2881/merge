import os
import requests
import logging
import json
from datetime import datetime
from dotenv import load_dotenv
from typing import Dict, List, Any, Optional

# Set up logging
logger = logging.getLogger('odds_api')
logger.setLevel(logging.INFO)
handler = logging.FileHandler('logs/odds_api.log')
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)
logger.addHandler(handler)

# Load environment variables
load_dotenv()
API_KEY = os.getenv('ODDS_API_KEY')
BASE_URL = 'https://api.the-odds-api.com/v4'

# British football leagues mapping
BRITISH_FOOTBALL_LEAGUES = {
    'soccer_epl': 'Premier League',
    'soccer_england_championship': 'Championship',
    'soccer_fa_cup': 'FA Cup',
    'soccer_league_cup': 'EFL Cup',
    'soccer_england_league1': 'League One',
    'soccer_england_league2': 'League Two',
    'soccer_spl': 'Scottish Premiership',
    'soccer_scotland_championship': 'Scottish Championship',
    'soccer_scotland_league_one': 'Scottish League One',
    'soccer_scotland_league_two': 'Scottish League Two'
}

# Market types relevant for football betting
FOOTBALL_MARKETS = [
    'h2h',           # 1X2 (home, draw, away)
    'spreads',       # Handicaps
    'totals',        # Over/Under
    'btts',          # Both teams to score
]

class OddsAPIClient:
    """Client for The Odds API with focus on British football markets"""
    
    def __init__(self):
        self.api_key = API_KEY
        self.base_url = BASE_URL
        if not self.api_key:
            logger.error("No API key found for The Odds API")
            raise ValueError("Missing ODDS_API_KEY in environment variables")
        
    def check_connection(self) -> bool:
        """Test connection to The Odds API"""
        try:
            response = self._make_request('sports')
            if isinstance(response, list):
                logger.info("The Odds API connection test successful")
                return True
            else:
                logger.error(f"The Odds API connection failed: {response}")
                return False
        except Exception as e:
            logger.error(f"The Odds API connection error: {e}")
            return False
        
    def _make_request(self, endpoint: str, params: Dict = None) -> Dict:
        """Make a request to The Odds API"""
        if params is None:
            params = {}
            
        # Always include API key
        params['apiKey'] = self.api_key
        
        url = f"{self.base_url}/{endpoint}"
        try:
            response = requests.get(url, params=params)
            response.raise_for_status()
            
            # Log remaining requests
            remaining = response.headers.get('x-requests-remaining', 'Unknown')
            logger.info(f"The Odds API request successful. Remaining: {remaining}")
            
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Error making request to The Odds API: {e}")
            return {"error": str(e)}
    
    def get_sports(self) -> List[Dict]:
        """Get list of available sports"""
        return self._make_request('sports')
    
    def get_british_football_leagues(self) -> List[Dict]:
        """Get list of British football leagues"""
        all_sports = self.get_sports()
        return [sport for sport in all_sports 
                if sport['key'] in BRITISH_FOOTBALL_LEAGUES.keys()]
    
    def get_upcoming_football_events(self, days_from_now: int = 3) -> List[Dict]:
        """Get upcoming football events in British leagues"""
        all_events = []
        
        for league_key in BRITISH_FOOTBALL_LEAGUES.keys():
            params = {
                'regions': 'uk',
                'oddsFormat': 'decimal',
                'dateFormat': 'iso',
                'markets': 'h2h'
            }
            
            events = self._make_request(f'sports/{league_key}/odds', params)
            if isinstance(events, list):
                # Add league name to each event for easier identification
                for event in events:
                    event['league_name'] = BRITISH_FOOTBALL_LEAGUES[league_key]
                all_events.extend(events)
        
        return all_events
    
    def get_event_odds(self, sport_key: str, event_id: str, markets: List[str] = None) -> Dict:
        """Get odds for a specific event with various market types"""
        if markets is None:
            markets = ['h2h']  # Default to 1X2 market
            
        params = {
            'regions': 'uk',
            'markets': ','.join(markets),
            'oddsFormat': 'decimal',
            'eventIds': event_id
        }
        
        return self._make_request(f'sports/{sport_key}/odds', params)
    
    def get_football_market_odds(self, market_type: str = 'h2h') -> List[Dict]:
        """Get odds for a specific market type across all British football leagues"""
        if market_type not in FOOTBALL_MARKETS:
            logger.warning(f"Unsupported market type: {market_type}. Using h2h instead.")
            market_type = 'h2h'
            
        all_odds = []
        
        for league_key in BRITISH_FOOTBALL_LEAGUES.keys():
            params = {
                'regions': 'uk',
                'markets': market_type,
                'oddsFormat': 'decimal',
                'dateFormat': 'iso'
            }
            
            odds = self._make_request(f'sports/{league_key}/odds', params)
            if isinstance(odds, list):
                for event in odds:
                    event['league_name'] = BRITISH_FOOTBALL_LEAGUES[league_key]
                all_odds.extend(odds)
        
        return all_odds
    
    def list_live_markets(self, competition_filter: List[str] = None) -> List[Dict]:
        """
        Get a list of live markets in a format compatible with the existing backend
        
        Args:
            competition_filter: Optional filter for specific competitions/leagues
            
        Returns:
            List of markets in the same format as Betfair/Smarkets API
        """
        events = self.get_upcoming_football_events()
        
        if not events:
            logger.warning("No events found in The Odds API")
            return []
        
        markets = []
        
        for event in events:
            # Filter by competition if specified
            if competition_filter and event.get('league_name') not in competition_filter:
                continue
                
            # Extract basic event data
            for bookmaker in event.get('bookmakers', []):
                for market in bookmaker.get('markets', []):
                    if market.get('key') == 'h2h':  # Only process 1X2 markets for now
                        market_id = f"{event['id']}_{bookmaker['key']}"
                        
                        markets.append({
                            'market_id': market_id,
                            'market_name': 'Match Odds',
                            'event_name': f"{event['home_team']} vs {event['away_team']}",
                            'competition': event.get('league_name', ''),
                            'start_time': event.get('commence_time'),
                            'bookmaker': bookmaker.get('title'),
                            'sport_key': event.get('sport_key'),
                            'sport_title': event.get('sport_title'),
                            'outcomes': market.get('outcomes', [])
                        })
        
        return markets
    
    def get_market_odds(self, market_id: str) -> Dict:
        """
        Get odds for a specific market in a format compatible with the existing backend
        
        Args:
            market_id: Market ID in the format "{event_id}_{bookmaker_key}"
            
        Returns:
            Odds data in a format compatible with Betfair/Smarkets
        """
        try:
            # Parse event_id and bookmaker_key from market_id
            parts = market_id.split('_')
            if len(parts) < 2:
                return {"detail": "Invalid market ID format"}
                
            event_id = parts[0]
            bookmaker_key = parts[1]
            
            # Find the event
            all_events = self.get_upcoming_football_events()
            event = next((e for e in all_events if e.get('id') == event_id), None)
            
            if not event:
                return {"detail": "Event not found"}
                
            # Find the bookmaker
            bookmaker = next((b for b in event.get('bookmakers', []) if b.get('key') == bookmaker_key), None)
            
            if not bookmaker:
                return {"detail": "Bookmaker not found for this event"}
                
            # Find the h2h market
            market = next((m for m in bookmaker.get('markets', []) if m.get('key') == 'h2h'), None)
            
            if not market:
                return {"detail": "Match Odds market not found"}
                
            # Format runners to match Betfair/Smarkets format
            runners = []
            for outcome in market.get('outcomes', []):
                selection_id = f"{event_id}_{bookmaker_key}_{outcome['name']}"
                runner_name = outcome['name']
                
                # For draw, the name is often just "Draw"
                if runner_name.lower() == "draw":
                    runner_name = "Draw"
                    
                # Set price as both back and lay for simplicity
                # In a real implementation, you would apply a margin
                price = outcome.get('price', 0)
                
                runners.append({
                    'selection_id': selection_id,
                    'runner_name': runner_name,
                    'back_odds': price,
                    'lay_odds': price * 1.05,  # Apply a 5% margin for lay odds
                    'last_price_traded': price
                })
            
            return {
                'market_id': market_id,
                'event_id': event_id,
                'bookmaker': bookmaker.get('title'),
                'event_name': f"{event['home_team']} vs {event['away_team']}",
                'competition': event.get('league_name', ''),
                'start_time': event.get('commence_time'),
                'runners': runners
            }
            
        except Exception as e:
            logger.error(f"Error getting market odds: {e}")
            return {"detail": f"Error retrieving odds: {str(e)}"}
    
    def save_football_odds(self, filename: str = 'logs/football_odds.json') -> str:
        """Save current football odds to a file"""
        odds = self.get_football_market_odds('h2h')
        with open(filename, 'w') as f:
            json.dump(odds, f, indent=2)
        logger.info(f"Saved {len(odds)} events to {filename}")
        return filename

# Usage example
if __name__ == "__main__":
    client = OddsAPIClient()
    # Test connection
    print(f"Connection test: {client.check_connection()}")
    
    # Get leagues
    leagues = client.get_british_football_leagues()
    print(f"Found {len(leagues)} British football leagues")
    
    # Get upcoming events
    events = client.get_upcoming_football_events()
    print(f"Found {len(events)} upcoming events")
    
    # Save odds to file
    client.save_football_odds()
