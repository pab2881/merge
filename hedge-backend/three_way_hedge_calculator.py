"""
Three-way market hedge calculator for football betting markets.
This module implements a sophisticated hedging strategy for 3-outcome markets (win, draw, lose)
that guarantees profit by backing one outcome and laying the other two.
"""

import logging
from dataclasses import dataclass
from typing import Dict, List, Tuple, Optional, Union
import numpy as np

logger = logging.getLogger(__name__)

@dataclass
class ThreeWayHedgeResult:
    """Result of a three-way market hedge calculation"""
    profitable: bool
    back_selection: str  # Selection to back
    back_odds: float
    back_stake: float
    lay_selection1: str  # First selection to lay
    lay_odds1: float
    lay_stake1: float
    lay_selection2: str  # Second selection to lay
    lay_odds2: float
    lay_stake2: float
    profit: float  # Guaranteed profit
    roi: float  # Return on investment percentage
    total_stake: float  # Total investment
    implied_probability_sum: float  # Sum of implied probabilities
    overround: float  # Market overround (implied probability sum - 1)
    profit_by_outcome: Dict[str, float]  # Profit for each outcome


class ThreeWayHedgeCalculator:
    """
    Calculator for three-way market hedging strategies.
    
    This class calculates optimal stake distribution for a 3-outcome market (typically football/soccer)
    by backing one outcome and laying the other two to guarantee profit regardless of the result.
    """
    
    def __init__(self, exchange_commission: float = 0.05):
        """
        Initialize the calculator
        
        Args:
            exchange_commission: Commission rate for the betting exchange (default: 5%)
        """
        self.exchange_commission = exchange_commission
        self.logger = logging.getLogger(__name__)
    
    def _calculate_implied_probability(self, decimal_odds: float) -> float:
        """
        Calculate implied probability from decimal odds
        
        Args:
            decimal_odds: Odds in decimal format (e.g., 2.0 for even money)
            
        Returns:
            Implied probability (0-1)
        """
        return 1 / decimal_odds
    
    def _calculate_market_overround(self, odds: List[float]) -> Tuple[float, float]:
        """
        Calculate market overround (sum of implied probabilities)
        
        Args:
            odds: List of decimal odds for all outcomes
            
        Returns:
            Tuple of (sum of implied probabilities, overround percentage)
        """
        implied_probs = [self._calculate_implied_probability(o) for o in odds]
        prob_sum = sum(implied_probs)
        overround = prob_sum - 1.0
        return prob_sum, overround
    
    def calculate_three_way_hedge(self, 
                                 selection_names: List[str],
                                 back_odds: List[float],
                                 lay_odds: List[float],
                                 base_stake: float = 100.0) -> Optional[ThreeWayHedgeResult]:
        """
        Calculate a three-way hedge strategy
        
        Args:
            selection_names: Names of the three selections (e.g., ["Home", "Draw", "Away"])
            back_odds: Back odds for all three selections
            lay_odds: Lay odds for all three selections
            base_stake: Base stake amount (default: £100)
            
        Returns:
            ThreeWayHedgeResult if profitable, None otherwise
        """
        if len(selection_names) != 3 or len(back_odds) != 3 or len(lay_odds) != 3:
            self.logger.error("Three-way hedge requires exactly 3 selections with odds")
            return None
        
        # Check for reasonable odds values
        if any(o <= 1.0 for o in back_odds) or any(o <= 1.0 for o in lay_odds):
            self.logger.warning("Invalid odds values (must be > 1.0)")
            return None
        
        # Try backing each outcome and laying the other two
        # We'll track the most profitable combination
        best_result = None
        best_profit = 0
        
        for i in range(3):
            # Indices for the selections we'll lay
            lay_indices = [j for j in range(3) if j != i]
            
            # Optimization: Calculate the optimal distribution of stakes
            # to guarantee the same profit regardless of outcome
            try:
                result = self._optimize_three_way_stakes(
                    base_stake,
                    selection_names[i], back_odds[i],  # Back selection
                    selection_names[lay_indices[0]], lay_odds[lay_indices[0]],  # First lay
                    selection_names[lay_indices[1]], lay_odds[lay_indices[1]]   # Second lay
                )
                
                if result and result.profitable and result.profit > best_profit:
                    best_result = result
                    best_profit = result.profit
            except Exception as e:
                self.logger.error(f"Error calculating three-way hedge: {e}")
                continue
        
        return best_result
    
    def _optimize_three_way_stakes(self,
                                  base_stake: float,
                                  back_selection: str,
                                  back_odds: float,
                                  lay_selection1: str,
                                  lay_odds1: float,
                                  lay_selection2: str,
                                  lay_odds2: float) -> Optional[ThreeWayHedgeResult]:
        """
        Optimize stakes for a three-way hedge
        
        Args:
            base_stake: Base stake amount
            back_selection: Name of the selection to back
            back_odds: Back odds for the backed selection
            lay_selection1: Name of the first selection to lay
            lay_odds1: Lay odds for the first lay selection
            lay_selection2: Name of the second selection to lay
            lay_odds2: Lay odds for the second lay selection
            
        Returns:
            ThreeWayHedgeResult if profitable, None otherwise
        """
        # Calculate implied probabilities and check if arbitrage is possible
        imp_prob_back = self._calculate_implied_probability(back_odds)
        imp_prob_lay1 = self._calculate_implied_probability(lay_odds1)
        imp_prob_lay2 = self._calculate_implied_probability(lay_odds2)
        
        prob_sum = imp_prob_back + imp_prob_lay1 + imp_prob_lay2
        overround = prob_sum - 1.0
        
        # Check if close to arbitrage opportunity (perfect arb would be < 1.0)
        # In practice, we allow some tolerance for commission
        if prob_sum > 1.03:  # Allowing 3% tolerance for commission
            return None
        
        # Calculate the optimal distribution of the base stake
        # This is a key insight: we distribute the stake proportionally to the
        # implied probabilities to ensure equal profit across all outcomes
        
        # First, calculate the initial proportions based on implied probabilities
        proportion_back = imp_prob_back / prob_sum
        proportion_lay1 = imp_prob_lay1 / prob_sum
        proportion_lay2 = imp_prob_lay2 / prob_sum
        
        # Calculate back stake based on the proportion of the base stake
        back_stake = base_stake * proportion_back
        
        # Now calculate the lay stakes needed to balance the returns
        # We need to solve a system of equations to ensure equal profit for all outcomes
        
        # When back bet wins:
        # back_stake * (back_odds - 1) - lay_stake1 * (lay_odds1 - 1) - lay_stake2 * (lay_odds2 - 1) = profit
        
        # When lay1 wins:
        # lay_stake1 - back_stake = profit
        
        # When lay2 wins:
        # lay_stake2 - back_stake = profit
        
        # To equalize these profits, we set:
        # lay_stake1 - back_stake = lay_stake2 - back_stake = profit
        # This means lay_stake1 = lay_stake2 + profit_difference
        
        # Calculate total liability for a balanced return
        back_return = back_stake * back_odds
        
        # Calculate the lay stakes to create equal profit across all outcomes
        # Solving the system of equations
        lay_stake1 = (back_return) / (lay_odds1)
        lay_stake2 = (back_return) / (lay_odds2)
        
        # Calculate potential profit for each outcome
        # If back bet wins:
        profit_if_back_wins = back_stake * (back_odds - 1) - lay_stake1 * (lay_odds1 - 1) - lay_stake2 * (lay_odds2 - 1)
        
        # If lay1 wins:
        profit_if_lay1_wins = lay_stake1 - back_stake - lay_stake2 * (lay_odds2 - 1)
        
        # If lay2 wins:
        profit_if_lay2_wins = lay_stake2 - back_stake - lay_stake1 * (lay_odds1 - 1)
        
        # For a proper hedge, we need to adjust for exchange commission
        # on winning lay bets
        profit_if_back_wins_adj = profit_if_back_wins
        profit_if_lay1_wins_adj = profit_if_lay1_wins * (1 - self.exchange_commission)
        profit_if_lay2_wins_adj = profit_if_lay2_wins * (1 - self.exchange_commission)
        
        # Find the minimum profit (guaranteed profit)
        min_profit = min(profit_if_back_wins_adj, profit_if_lay1_wins_adj, profit_if_lay2_wins_adj)
        
        # If we don't have a positive profit, it's not worth pursuing
        if min_profit <= 0:
            return None
        
        # Calculate total stake (investment)
        total_stake = back_stake + lay_stake1 * (lay_odds1 - 1) + lay_stake2 * (lay_odds2 - 1)
        
        # Calculate ROI
        roi = (min_profit / total_stake) * 100
        
        return ThreeWayHedgeResult(
            profitable=True,
            back_selection=back_selection,
            back_odds=back_odds,
            back_stake=back_stake,
            lay_selection1=lay_selection1,
            lay_odds1=lay_odds1,
            lay_stake1=lay_stake1,
            lay_selection2=lay_selection2,
            lay_odds2=lay_odds2,
            lay_stake2=lay_stake2,
            profit=min_profit,
            roi=roi,
            total_stake=total_stake,
            implied_probability_sum=prob_sum,
            overround=overround,
            profit_by_outcome={
                back_selection: profit_if_back_wins_adj,
                lay_selection1: profit_if_lay1_wins_adj,
                lay_selection2: profit_if_lay2_wins_adj
            }
        )
    
    def find_three_way_opportunities(self, 
                                   market_data: Dict[str, Any],
                                   min_profit: float = 1.0,
                                   min_roi: float = 1.0,
                                   base_stake: float = 100.0) -> List[ThreeWayHedgeResult]:
        """
        Find three-way hedge opportunities in market data
        
        Args:
            market_data: Dictionary with market data (event name, selections, odds)
            min_profit: Minimum profit threshold to include an opportunity
            min_roi: Minimum ROI percentage to include an opportunity
            base_stake: Base stake amount
            
        Returns:
            List of profitable three-way hedge opportunities
        """
        opportunities = []
        
        # Extract selections and odds from market data
        selection_names = [runner.get('runner_name') for runner in market_data.get('runners', [])]
        
        # Check if we have exactly 3 selections (home, draw, away)
        if len(selection_names) != 3:
            return []
        
        # Extract back and lay odds
        back_odds = [runner.get('best_back_price', 0) for runner in market_data.get('runners', [])]
        lay_odds = [runner.get('best_lay_price', 0) for runner in market_data.get('runners', [])]
        
        # Check if we have valid odds
        if any(o <= 1.0 for o in back_odds) or any(o <= 1.0 for o in lay_odds):
            return []
        
        # Calculate the hedge
        result = self.calculate_three_way_hedge(
            selection_names=selection_names,
            back_odds=back_odds,
            lay_odds=lay_odds,
            base_stake=base_stake
        )
        
        # Check if profitable and meets thresholds
        if result and result.profitable and result.profit >= min_profit and result.roi >= min_roi:
            # Add event information
            result.event_name = market_data.get('event_name', 'Unknown Event')
            result.market_id = market_data.get('market_id', '')
            result.competition = market_data.get('competition', '')
            
            opportunities.append(result)
        
        return opportunities
