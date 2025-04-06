import logging
from typing import Dict, List, Any, Tuple, Optional
from difflib import SequenceMatcher
import re
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class MarketMatcher:
    """
    Utility for matching markets between different betting platforms
    """
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    @staticmethod
    def _normalize_team_name(name: str) -> str:
        """
        Normalize team names to improve matching
        """
        # Remove common suffixes like "FC", punctuation
        name = re.sub(r'\s+FC$|\s+United$|\s+City$', '', name)
        # Remove non-alphanumeric characters
        name = re.sub(r'[^\w\s]', '', name)
        # Convert to lowercase and strip whitespace
        return name.lower().strip()
    
    @staticmethod
    def _calculate_similarity(str1: str, str2: str) -> float:
        """
        Calculate similarity ratio between two strings
        """
        return SequenceMatcher(None, str1, str2).ratio()
    
    @staticmethod
    def _normalize_market_name(name: str) -> str:
        """
        Normalize market names across platforms
        """
        # Common market name mappings
        market_mappings = {
            "match odds": "match_odds",
            "match betting": "match_odds",
            "1x2": "match_odds",
            "win-draw-win": "match_odds",
            "winner": "match_odds"
        }
        
        name_lower = name.lower().strip()
        for key, value in market_mappings.items():
            if key in name_lower:
                return value
        
        return name_lower
    
    def _extract_teams_from_event(self, event_name: str) -> Tuple[str, str]:
        """
        Extract home and away team names from an event name
        """
        # Common patterns: "Team A vs Team B", "Team A v Team B", "Team A - Team B"
        separators = [" vs ", " v ", " - ", " @ "]
        
        for separator in separators:
            if separator in event_name:
                teams = event_name.split(separator, 1)
                return (
                    self._normalize_team_name(teams[0]),
                    self._normalize_team_name(teams[1])
                )
        
        # If no separator found, return the whole name and empty string
        return self._normalize_team_name(event_name), ""
    
    def match_markets(self, betfair_markets: List[Dict[str, Any]], 
                     smarkets_markets: List[Dict[str, Any]], 
                     similarity_threshold: float = 0.8) -> List[Dict[str, Any]]:
        """
        Match markets between Betfair and Smarkets
        
        Args:
            betfair_markets: List of markets from Betfair
            smarkets_markets: List of markets from Smarkets
            similarity_threshold: Minimum similarity score to consider a match
            
        Returns:
            List of matched markets with both platform IDs
        """
        self.logger.info(f"Matching {len(betfair_markets)} Betfair markets with {len(smarkets_markets)} Smarkets markets")
        
        matched_markets = []
        
        for betfair_market in betfair_markets:
            betfair_event_name = betfair_market.get("event_name", "")
            betfair_market_name = self._normalize_market_name(betfair_market.get("name", ""))
            
            # Only proceed with market odds markets
            if betfair_market_name != "match_odds":
                continue
                
            betfair_home, betfair_away = self._extract_teams_from_event(betfair_event_name)
            betfair_start_time = betfair_market.get("startTime")
            
            best_match = None
            best_score = 0
            
            for smarkets_market in smarkets_markets:
                smarkets_event_name = smarkets_market.get("event_name", "")
                smarkets_market_name = self._normalize_market_name(smarkets_market.get("market_name", ""))
                
                # Only match markets of the same type
                if smarkets_market_name != "match_odds":
                    continue
                    
                smarkets_home, smarkets_away = self._extract_teams_from_event(smarkets_event_name)
                smarkets_start_time = smarkets_market.get("start_time")
                
                # Check if start times are within 1 hour of each other if both are available
                if betfair_start_time and smarkets_start_time:
                    betfair_dt = datetime.fromisoformat(betfair_start_time.replace('Z', '+00:00'))
                    smarkets_dt = datetime.fromisoformat(smarkets_start_time.replace('Z', '+00:00'))
                    
                    if abs((betfair_dt - smarkets_dt).total_seconds()) > 3600:  # 1 hour
                        continue
                
                # Calculate team name similarity
                home_similarity = self._calculate_similarity(betfair_home, smarkets_home)
                away_similarity = self._calculate_similarity(betfair_away, smarkets_away)
                
                # Calculate overall similarity
                avg_similarity = (home_similarity + away_similarity) / 2
                
                if avg_similarity > best_score and avg_similarity >= similarity_threshold:
                    best_score = avg_similarity
                    best_match = smarkets_market
            
            if best_match:
                matched_markets.append({
                    "betfair_market_id": betfair_market.get("id"),
                    "smarkets_market_id": best_match.get("market_id"),
                    "event_name": betfair_event_name,
                    "competition": betfair_market.get("competition"),
                    "start_time": betfair_start_time,
                    "similarity_score": best_score,
                    "betfair_market": betfair_market,
                    "smarkets_market": best_match
                })
        
        self.logger.info(f"Successfully matched {len(matched_markets)} markets")
        return matched_markets
    
    def find_runner_matches(self, betfair_runners: List[Dict[str, Any]], 
                           smarkets_runners: List[Dict[str, Any]],
                           similarity_threshold: float = 0.7) -> Dict[str, str]:
        """
        Match runners (selections) between Betfair and Smarkets
        
        Args:
            betfair_runners: List of runners from Betfair
            smarkets_runners: List of runners from Smarkets
            similarity_threshold: Minimum similarity score to consider a match
            
        Returns:
            Dictionary mapping Betfair selection IDs to Smarkets selection IDs
        """
        runner_matches = {}
        
        for betfair_runner in betfair_runners:
            betfair_name = self._normalize_team_name(betfair_runner.get("runner_name", ""))
            betfair_id = betfair_runner.get("selection_id")
            
            best_match = None
            best_score = 0
            
            for smarkets_runner in smarkets_runners:
                smarkets_name = self._normalize_team_name(smarkets_runner.get("runner_name", ""))
                similarity = self._calculate_similarity(betfair_name, smarkets_name)
                
                if similarity > best_score and similarity >= similarity_threshold:
                    best_score = similarity
                    best_match = smarkets_runner
            
            if best_match:
                runner_matches[betfair_id] = best_match.get("selection_id")
        
        return runner_matches

# Example usage
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    matcher = MarketMatcher()
    
    # Example markets
    betfair_markets = [
        {
            "id": "1.123456",
            "name": "Match Odds",
            "event_name": "Liverpool vs Arsenal",
            "competition": "Premier League",
            "startTime": "2023-12-31T15:00:00Z"
        }
    ]
    
    smarkets_markets = [
        {
            "market_id": "sm_123",
            "market_name": "1X2",
            "event_name": "Liverpool v Arsenal",
            "competition": "Premier League",
            "start_time": "2023-12-31T15:00:00Z"
        }
    ]
    
    matches = matcher.match_markets(betfair_markets, smarkets_markets)
    print(f"Found {len(matches)} matched markets")
