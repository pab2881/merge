import logging
from typing import Dict, List, Any, Optional, Tuple, Union
from enum import Enum
from dataclasses import dataclass

from hedge_calculator import HedgeCalculator, HedgeOpportunity

logger = logging.getLogger(__name__)

class HedgeType(Enum):
    """Enum representing different types of hedge opportunities"""
    EXCHANGE_INTERNAL = "exchange_internal"        # Back/lay within same exchange
    CROSS_EXCHANGE = "cross_exchange"              # Back on one exchange, lay on another
    BOOKMAKER_EXCHANGE = "bookmaker_exchange"      # Back on bookmaker, lay on exchange
    BOOKMAKER_BOOKMAKER = "bookmaker_bookmaker"    # Back on one bookmaker, opposite outcome on another
    MULTI_LEG = "multi_leg"                        # Multiple legs to cover all outcomes

@dataclass
class EnhancedHedgeOpportunity(HedgeOpportunity):
    """Enhanced hedge opportunity with additional fields for hedge type and multi-leg"""
    hedge_type: HedgeType = HedgeType.CROSS_EXCHANGE
    is_multi_leg: bool = False
    leg_count: int = 2
    opposing_selections: List[Dict[str, Any]] = None
    total_liability: float = 0.0
    max_return: float = 0.0
    min_profit: float = 0.0

class HedgeTypeAnalyzer:
    """
    Advanced analyzer for identifying and calculating various hedge bet types
    across multiple platforms including exchanges and traditional bookmakers
    """
    
    def __init__(self, calculator: HedgeCalculator):
        self.logger = logging.getLogger(__name__)
        self.calculator = calculator
    
    def analyze_exchange_internal(self, 
                                 exchange_name: str,
                                 market_id: str, 
                                 odds_data: Dict[str, Any],
                                 stake: float = 100.0) -> List[EnhancedHedgeOpportunity]:
        """
        Find internal hedging opportunities within a single exchange (back/lay on same exchange)
        
        Args:
            exchange_name: Name of the exchange ('betfair' or 'smarkets')
            market_id: Exchange market ID
            odds_data: Odds data for the market
            stake: Stake amount
            
        Returns:
            List of hedge opportunities
        """
        opportunities = []
        
        # Determine commission based on exchange
        if exchange_name.lower() == 'betfair':
            commission = self.calculator.BETFAIR_COMMISSION
        elif exchange_name.lower() == 'smarkets':
            commission = self.calculator.SMARKETS_COMMISSION
        else:
            self.logger.error(f"Unknown exchange: {exchange_name}")
            return []
        
        # Check each runner for back/lay opportunities
        for runner in odds_data.get('runners', []):
            back_odds = runner.get('best_back_price')
            lay_odds = runner.get('best_lay_price')
            
            if not back_odds or not lay_odds or back_odds <= 0 or lay_odds <= 0:
                continue
            
            # Only calculate if lay odds are greater than back odds (potential arb)
            if back_odds > lay_odds:
                hedge_result = self.calculator.calculate_hedge(
                    back_odds,
                    lay_odds,
                    stake,
                    commission,
                    commission
                )
                
                if hedge_result and hedge_result['profit'] > 0:
                    opportunity = EnhancedHedgeOpportunity(
                        event_name=odds_data.get('event_name', 'Unknown Event'),
                        runner_name=runner.get('runner_name', 'Unknown Runner'),
                        back_exchange=exchange_name.capitalize(),
                        lay_exchange=exchange_name.capitalize(),
                        back_odds=back_odds,
                        lay_odds=lay_odds,
                        stake=stake,
                        lay_stake=hedge_result['lay_stake'],
                        profit=hedge_result['profit'],
                        profit_percentage=hedge_result['profit_percentage'],
                        back_market_id=market_id,
                        lay_market_id=market_id,
                        back_selection_id=runner.get('selection_id'),
                        lay_selection_id=runner.get('selection_id'),
                        back_commission=commission,
                        lay_commission=commission,
                        back_platform=exchange_name.lower(),
                        lay_platform=exchange_name.lower(),
                        hedge_type=HedgeType.EXCHANGE_INTERNAL,
                        is_multi_leg=False,
                        leg_count=2
                    )
                    opportunities.append(opportunity)
        
        return sorted(opportunities, key=lambda x: x.profit, reverse=True)
    
    def analyze_cross_exchange(self,
                              betfair_market_id: str,
                              smarkets_market_id: str,
                              betfair_odds: Dict[str, Any],
                              smarkets_odds: Dict[str, Any],
                              runner_matches: Dict[str, str],
                              stake: float = 100.0) -> List[EnhancedHedgeOpportunity]:
        """
        Find cross-exchange hedging opportunities between Betfair and Smarkets
        
        Args:
            betfair_market_id: Betfair market ID
            smarkets_market_id: Smarkets market ID
            betfair_odds: Odds data from Betfair
            smarkets_odds: Odds data from Smarkets
            runner_matches: Dictionary mapping Betfair selection IDs to Smarkets selection IDs
            stake: Stake amount
            
        Returns:
            List of hedge opportunities
        """
        opportunities = []
        
        # Create lookup dictionaries for runners by selection ID
        betfair_runners = {runner.get("selection_id"): runner for runner in betfair_odds.get("runners", [])}
        smarkets_runners = {runner.get("selection_id"): runner for runner in smarkets_odds.get("runners", [])}
        
        # Check Betfair back vs Smarkets lay
        for bf_selection_id, sm_selection_id in runner_matches.items():
            bf_runner = betfair_runners.get(bf_selection_id)
            sm_runner = smarkets_runners.get(sm_selection_id)
            
            if not bf_runner or not sm_runner:
                continue
                
            bf_back_odds = bf_runner.get("best_back_price")
            sm_lay_odds = sm_runner.get("best_lay_price")
            
            if bf_back_odds and sm_lay_odds and bf_back_odds > 0 and sm_lay_odds > 0:
                hedge_result = self.calculator.calculate_hedge(
                    bf_back_odds, 
                    sm_lay_odds, 
                    stake, 
                    self.calculator.BETFAIR_COMMISSION, 
                    self.calculator.SMARKETS_COMMISSION
                )
                
                if hedge_result and hedge_result["profit"] > 0:
                    opportunity = EnhancedHedgeOpportunity(
                        event_name=betfair_odds.get("event_name", "Unknown Event"),
                        runner_name=bf_runner.get("runner_name", "Unknown Runner"),
                        back_exchange="Betfair",
                        lay_exchange="Smarkets",
                        back_odds=bf_back_odds,
                        lay_odds=sm_lay_odds,
                        stake=stake,
                        lay_stake=hedge_result["lay_stake"],
                        profit=hedge_result["profit"],
                        profit_percentage=hedge_result["profit_percentage"],
                        back_market_id=betfair_market_id,
                        lay_market_id=smarkets_market_id,
                        back_selection_id=bf_selection_id,
                        lay_selection_id=sm_selection_id,
                        back_commission=self.calculator.BETFAIR_COMMISSION,
                        lay_commission=self.calculator.SMARKETS_COMMISSION,
                        back_platform="betfair",
                        lay_platform="smarkets",
                        hedge_type=HedgeType.CROSS_EXCHANGE,
                        is_multi_leg=False,
                        leg_count=2
                    )
                    opportunities.append(opportunity)
        
        # Check Smarkets back vs Betfair lay
        for bf_selection_id, sm_selection_id in runner_matches.items():
            bf_runner = betfair_runners.get(bf_selection_id)
            sm_runner = smarkets_runners.get(sm_selection_id)
            
            if not bf_runner or not sm_runner:
                continue
                
            sm_back_odds = sm_runner.get("best_back_price")
            bf_lay_odds = bf_runner.get("best_lay_price")
            
            if sm_back_odds and bf_lay_odds and sm_back_odds > 0 and bf_lay_odds > 0:
                hedge_result = self.calculator.calculate_hedge(
                    sm_back_odds, 
                    bf_lay_odds, 
                    stake, 
                    self.calculator.SMARKETS_COMMISSION, 
                    self.calculator.BETFAIR_COMMISSION
                )
                
                if hedge_result and hedge_result["profit"] > 0:
                    opportunity = EnhancedHedgeOpportunity(
                        event_name=betfair_odds.get("event_name", "Unknown Event"),
                        runner_name=bf_runner.get("runner_name", "Unknown Runner"),
                        back_exchange="Smarkets",
                        lay_exchange="Betfair",
                        back_odds=sm_back_odds,
                        lay_odds=bf_lay_odds,
                        stake=stake,
                        lay_stake=hedge_result["lay_stake"],
                        profit=hedge_result["profit"],
                        profit_percentage=hedge_result["profit_percentage"],
                        back_market_id=smarkets_market_id,
                        lay_market_id=betfair_market_id,
                        back_selection_id=sm_selection_id,
                        lay_selection_id=bf_selection_id,
                        back_commission=self.calculator.SMARKETS_COMMISSION,
                        lay_commission=self.calculator.BETFAIR_COMMISSION,
                        back_platform="smarkets",
                        lay_platform="betfair",
                        hedge_type=HedgeType.CROSS_EXCHANGE,
                        is_multi_leg=False,
                        leg_count=2
                    )
                    opportunities.append(opportunity)
        
        return sorted(opportunities, key=lambda x: x.profit, reverse=True)
    
    def analyze_bookmaker_exchange(self,
                                  bookmaker_market_id: str,
                                  exchange_market_id: str,
                                  exchange_name: str,
                                  bookmaker_odds: Dict[str, Any],
                                  exchange_odds: Dict[str, Any],
                                  runner_matches: Dict[str, str],
                                  stake: float = 100.0) -> List[EnhancedHedgeOpportunity]:
        """
        Find hedging opportunities between a bookmaker and an exchange
        
        Args:
            bookmaker_market_id: Bookmaker market ID
            exchange_market_id: Exchange market ID
            exchange_name: Name of the exchange ('betfair' or 'smarkets')
            bookmaker_odds: Odds data from the bookmaker
            exchange_odds: Odds data from the exchange
            runner_matches: Dictionary mapping bookmaker selection IDs to exchange selection IDs
            stake: Stake amount
            
        Returns:
            List of hedge opportunities
        """
        opportunities = []
        
        # Determine exchange commission
        if exchange_name.lower() == 'betfair':
            commission = self.calculator.BETFAIR_COMMISSION
        elif exchange_name.lower() == 'smarkets':
            commission = self.calculator.SMARKETS_COMMISSION
        else:
            self.logger.error(f"Unknown exchange: {exchange_name}")
            return []
        
        # Create lookup dictionaries for runners by selection ID
        bookmaker_runners = {runner.get("selection_id"): runner for runner in bookmaker_odds.get("runners", [])}
        exchange_runners = {runner.get("selection_id"): runner for runner in exchange_odds.get("runners", [])}
        
        # Check bookmaker back vs exchange lay
        for bm_selection_id, ex_selection_id in runner_matches.items():
            bm_runner = bookmaker_runners.get(bm_selection_id)
            ex_runner = exchange_runners.get(ex_selection_id)
            
            if not bm_runner or not ex_runner:
                continue
                
            bm_odds = bm_runner.get("back_odds")  # Use back odds from bookmaker
            ex_lay_odds = ex_runner.get("best_lay_price")
            
            if bm_odds and ex_lay_odds and bm_odds > 0 and ex_lay_odds > 0:
                hedge_result = self.calculator.calculate_bookmaker_hedge(
                    bm_odds, 
                    ex_lay_odds, 
                    stake, 
                    commission
                )
                
                if hedge_result and hedge_result["profit"] > 0:
                    bookmaker_name = bookmaker_odds.get("bookmaker", bookmaker_odds.get("back_exchange", "Bookmaker"))
                    
                    opportunity = EnhancedHedgeOpportunity(
                        event_name=bookmaker_odds.get("event_name", "Unknown Event"),
                        runner_name=bm_runner.get("runner_name", "Unknown Runner"),
                        back_exchange=bookmaker_name,
                        lay_exchange=exchange_name.capitalize(),
                        back_odds=bm_odds,
                        lay_odds=ex_lay_odds,
                        stake=stake,
                        lay_stake=hedge_result["lay_stake"],
                        profit=hedge_result["profit"],
                        profit_percentage=hedge_result["profit_percentage"],
                        back_market_id=bookmaker_market_id,
                        lay_market_id=exchange_market_id,
                        back_selection_id=bm_selection_id,
                        lay_selection_id=ex_selection_id,
                        back_commission=0.0,  # No commission on back bet with bookmaker
                        lay_commission=commission,
                        back_platform="oddsapi",
                        lay_platform=exchange_name.lower(),
                        hedge_type=HedgeType.BOOKMAKER_EXCHANGE,
                        is_multi_leg=False,
                        leg_count=2
                    )
                    opportunities.append(opportunity)
        
        return sorted(opportunities, key=lambda x: x.profit, reverse=True)
    
    def analyze_bookmaker_bookmaker(self,
                                   bookmaker1_market_id: str,
                                   bookmaker2_market_id: str,
                                   bookmaker1_odds: Dict[str, Any],
                                   bookmaker2_odds: Dict[str, Any],
                                   opposing_runner_matches: Dict[str, str],
                                   stake: float = 100.0) -> List[EnhancedHedgeOpportunity]:
        """
        Find hedging opportunities between opposing outcomes on different bookmakers
        
        Args:
            bookmaker1_market_id: First bookmaker market ID
            bookmaker2_market_id: Second bookmaker market ID
            bookmaker1_odds: Odds data from first bookmaker
            bookmaker2_odds: Odds data from second bookmaker
            opposing_runner_matches: Dictionary mapping selections with opposing outcomes
            stake: Stake amount
            
        Returns:
            List of hedge opportunities
        """
        opportunities = []
        
        # Create lookup dictionaries for runners by selection ID
        bookmaker1_runners = {runner.get("selection_id"): runner for runner in bookmaker1_odds.get("runners", [])}
        bookmaker2_runners = {runner.get("selection_id"): runner for runner in bookmaker2_odds.get("runners", [])}
        
        # Since bookmakers don't offer lay bets, we need to find opposing outcomes
        # For example: Home Win vs Draw/Away Win, Over 2.5 vs Under 2.5
        for bm1_selection_id, bm2_selection_id in opposing_runner_matches.items():
            bm1_runner = bookmaker1_runners.get(bm1_selection_id)
            bm2_runner = bookmaker2_runners.get(bm2_selection_id)
            
            if not bm1_runner or not bm2_runner:
                continue
                
            bm1_odds = bm1_runner.get("back_odds")
            bm2_odds = bm2_runner.get("back_odds")
            
            if bm1_odds and bm2_odds and bm1_odds > 0 and bm2_odds > 0:
                # Calculate stakes for arbitrage between two back bets
                total_stake = stake
                bm1_stake = (total_stake * bm2_odds) / (bm1_odds + bm2_odds)
                bm2_stake = total_stake - bm1_stake
                
                # Calculate returns
                bm1_return = bm1_stake * bm1_odds
                bm2_return = bm2_stake * bm2_odds
                
                # Calculate profit
                profit_if_bm1_wins = bm1_return - total_stake
                profit_if_bm2_wins = bm2_return - total_stake
                
                # Check if this is profitable (arbitrage)
                min_profit = min(profit_if_bm1_wins, profit_if_bm2_wins)
                profit_percentage = (min_profit / total_stake) * 100
                
                if min_profit > 0:
                    bookmaker1_name = bookmaker1_odds.get("bookmaker", "Bookmaker 1")
                    bookmaker2_name = bookmaker2_odds.get("bookmaker", "Bookmaker 2")
                    
                    opportunity = EnhancedHedgeOpportunity(
                        event_name=bookmaker1_odds.get("event_name", "Unknown Event"),
                        runner_name=f"{bm1_runner.get('runner_name')} vs {bm2_runner.get('runner_name')}",
                        back_exchange=bookmaker1_name,
                        lay_exchange=bookmaker2_name,
                        back_odds=bm1_odds,
                        lay_odds=bm2_odds,
                        stake=bm1_stake,  # Adjusted stake for first bet
                        lay_stake=bm2_stake,  # Stake for second bet (not really a lay)
                        profit=min_profit,
                        profit_percentage=profit_percentage,
                        back_market_id=bookmaker1_market_id,
                        lay_market_id=bookmaker2_market_id,
                        back_selection_id=bm1_selection_id,
                        lay_selection_id=bm2_selection_id,
                        back_commission=0.0,
                        lay_commission=0.0,
                        back_platform="oddsapi",
                        lay_platform="oddsapi",
                        hedge_type=HedgeType.BOOKMAKER_BOOKMAKER,
                        is_multi_leg=True,
                        leg_count=2,
                        opposing_selections=[
                            {"selection": bm1_runner.get('runner_name'), "stake": bm1_stake, "odds": bm1_odds},
                            {"selection": bm2_runner.get('runner_name'), "stake": bm2_stake, "odds": bm2_odds}
                        ],
                        total_liability=total_stake,
                        max_return=max(bm1_return, bm2_return),
                        min_profit=min_profit
                    )
                    opportunities.append(opportunity)
        
        return sorted(opportunities, key=lambda x: x.profit, reverse=True)
    
    def analyze_multi_leg_hedge(self,
                               main_market_id: str,
                               main_selection_id: str,
                               main_platform: str,
                               main_odds_data: Dict[str, Any],
                               related_markets: List[Dict[str, Any]],
                               stake: float = 100.0) -> List[EnhancedHedgeOpportunity]:
        """
        Find complex multi-leg hedging opportunities
        
        Args:
            main_market_id: Market ID for the main bet
            main_selection_id: Selection ID for the main bet
            main_platform: Platform for the main bet ('betfair', 'smarkets', 'oddsapi')
            main_odds_data: Odds data for the main market
            related_markets: List of related markets data for other legs
            stake: Stake amount
            
        Returns:
            List of multi-leg hedge opportunities
        """
        opportunities = []
        
        # Get main selection details
        main_runner = None
        for runner in main_odds_data.get('runners', []):
            if runner.get('selection_id') == main_selection_id:
                main_runner = runner
                break
                
        if not main_runner:
            return []
            
        main_odds = main_runner.get('back_odds') or main_runner.get('best_back_price', 0)
        if main_odds <= 0:
            return []
            
        # Determine commission if applicable
        main_commission = 0.0
        if main_platform == 'betfair':
            main_commission = self.calculator.BETFAIR_COMMISSION
        elif main_platform == 'smarkets':
            main_commission = self.calculator.SMARKETS_COMMISSION
            
        # Calculate potential return from main bet
        main_return = stake * main_odds * (1 - main_commission)
        
        # Try to find combinations of other legs that hedge against the main bet
        for markets_combination in self._generate_market_combinations(related_markets):
            # Calculate optimal stakes across the hedging legs
            hedge_legs = self._calculate_multi_leg_hedge(main_return, markets_combination, stake)
            
            if hedge_legs and hedge_legs['profitable']:
                # Format the multi-leg opportunity
                opportunity = EnhancedHedgeOpportunity(
                    event_name=main_odds_data.get("event_name", "Unknown Event"),
                    runner_name=main_runner.get("runner_name", "Unknown Runner"),
                    back_exchange=self._get_platform_display_name(main_platform),
                    lay_exchange="Multiple",  # Multiple platforms for different legs
                    back_odds=main_odds,
                    lay_odds=0.0,  # Not applicable for multi-leg
                    stake=stake,
                    lay_stake=hedge_legs['total_stake'],
                    profit=hedge_legs['min_profit'],
                    profit_percentage=(hedge_legs['min_profit'] / stake) * 100,
                    back_market_id=main_market_id,
                    lay_market_id="",  # Multiple markets
                    back_selection_id=main_selection_id,
                    lay_selection_id="",  # Multiple selections
                    back_commission=main_commission,
                    lay_commission=0.0,  # Multiple commissions
                    back_platform=main_platform,
                    lay_platform="multiple",
                    hedge_type=HedgeType.MULTI_LEG,
                    is_multi_leg=True,
                    leg_count=len(hedge_legs['legs']) + 1,
                    opposing_selections=[
                        {"selection": main_runner.get('runner_name'), "stake": stake, "odds": main_odds, "platform": main_platform}
                    ] + hedge_legs['legs'],
                    total_liability=stake + hedge_legs['total_stake'],
                    max_return=max(main_return, hedge_legs['min_return']),
                    min_profit=hedge_legs['min_profit']
                )
                opportunities.append(opportunity)
        
        return sorted(opportunities, key=lambda x: x.profit, reverse=True)
    
    def _generate_market_combinations(self, markets: List[Dict[str, Any]]) -> List[List[Dict[str, Any]]]:
        """
        Generate all valid combinations of markets for multi-leg hedging
        
        This is a complex algorithm that attempts to find valid combinations
        of markets that could form a complete hedge against the main bet.
        """
        # This is a simplified implementation
        # In practice, this would use more sophisticated logic
        result = []
        
        # For now, just return each market individually
        for market in markets:
            result.append([market])
            
        # In practice, you would also include combinations
        # For example, for a football match, you might hedge a "Team A Win" bet
        # with both "Draw" and "Team B Win" bets
            
        return result
    
    def _calculate_multi_leg_hedge(self, 
                                  main_return: float, 
                                  hedge_markets: List[Dict[str, Any]],
                                  original_stake: float) -> Optional[Dict[str, Any]]:
        """
        Calculate optimal stakes for multi-leg hedging
        
        Args:
            main_return: Expected return from the main bet
            hedge_markets: List of markets for the hedge legs
            original_stake: Original stake amount
            
        Returns:
            Dictionary with hedge legs details or None if not profitable
        """
        # This is a simplified implementation
        # In practice, this would use mathematical optimization
        
        # Extract all possible selections from the hedge markets
        all_selections = []
        for market in hedge_markets:
            for runner in market.get('runners', []):
                # For exchanges, use lay odds
                if market.get('platform') in ['betfair', 'smarkets']:
                    odds = runner.get('best_lay_price', 0)
                    commission = (0.05 if market.get('platform') == 'betfair' else 0.02)
                # For bookmakers, use back odds
                else:
                    odds = runner.get('back_odds', 0)
                    commission = 0.0
                    
                if odds > 0:
                    all_selections.append({
                        'market_id': market.get('market_id', ''),
                        'selection_id': runner.get('selection_id', ''),
                        'runner_name': runner.get('runner_name', ''),
                        'odds': odds,
                        'commission': commission,
                        'platform': market.get('platform', '')
                    })
        
        # Find combinations of selections that cover all outcomes
        # (simplified for demonstration)
        if not all_selections:
            return None
            
        # Just use the first selection for demonstration
        selection = all_selections[0]
        
        # Calculate required stake to balance returns
        required_stake = main_return / selection['odds']
        
        # Check if profitable
        total_stake = original_stake + required_stake
        min_return = min(main_return, required_stake * selection['odds'] * (1 - selection['commission']))
        min_profit = min_return - total_stake
        
        if min_profit <= 0:
            return None
            
        return {
            'profitable': True,
            'total_stake': required_stake,
            'min_return': min_return,
            'min_profit': min_profit,
            'legs': [
                {
                    'selection': selection['runner_name'],
                    'stake': required_stake,
                    'odds': selection['odds'],
                    'platform': selection['platform'],
                    'market_id': selection['market_id'],
                    'selection_id': selection['selection_id']
                }
            ]
        }
    
    def _get_platform_display_name(self, platform: str) -> str:
        """Get display name for platform"""
        if platform == 'betfair':
            return 'Betfair'
        elif platform == 'smarkets':
            return 'Smarkets'
        elif platform == 'oddsapi':
            return 'Bookmaker'
        return platform.capitalize()
    
    def find_best_hedge_opportunities(self,
                                     all_platform_data: Dict[str, Dict[str, Dict[str, Any]]],
                                     stake: float = 100.0,
                                     min_profit_percentage: float = 0.5) -> List[EnhancedHedgeOpportunity]:
        """
        Find the best hedge opportunities across all platforms and hedge types
        
        Args:
            all_platform_data: Dictionary containing all odds data by platform and market ID
            stake: Stake amount
            min_profit_percentage: Minimum profit percentage to include
            
        Returns:
            List of hedge opportunities sorted by profit percentage
        """
        all_opportunities = []
        
        # Extract platform data for easier access
        betfair_data = all_platform_data.get('betfair', {})
        smarkets_data = all_platform_data.get('smarkets', {})
        oddsapi_data = all_platform_data.get('oddsapi', {})
        
        # 1. Exchange Internal hedges
        for exchange, data in [('betfair', betfair_data), ('smarkets', smarkets_data)]:
            for market_id, odds_data in data.items():
                opportunities = self.analyze_exchange_internal(
                    exchange_name=exchange,
                    market_id=market_id,
                    odds_data=odds_data,
                    stake=stake
                )
                all_opportunities.extend(opportunities)
        
        # 2. Cross-Exchange hedges
        # We would need market matches data here, which would come from your matcher module
        # This is just a placeholder for demonstration
        cross_exchange_matches = {}  # Would be populated from your matcher
        
        # 3. Bookmaker-Exchange hedges
        # Again, we would need market matches data here
        
        # 4. Bookmaker-Bookmaker hedges
        # This is more complex and requires identifying opposing outcomes
        
        # 5. Multi-leg hedges
        # This is the most complex type and requires understanding market relationships
        
        # Filter by minimum profit percentage
        filtered_opportunities = [
            op for op in all_opportunities if op.profit_percentage >= min_profit_percentage
        ]
        
        # Sort by profit percentage
        return sorted(filtered_opportunities, key=lambda x: x.profit_percentage, reverse=True)

# Example usage
if __name__ == "__main__":
    from hedge_calculator import HedgeCalculator
    
    calculator = HedgeCalculator()
    analyzer = HedgeTypeAnalyzer(calculator)
    
    # This would be used with real data in your application
    best_opportunities = analyzer.find_best_hedge_opportunities({}, 100.0, 0.5)
    print(f"Found {len(best_opportunities)} profitable hedge opportunities")
