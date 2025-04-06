from betfair_api import BetfairAPI

bf = BetfairAPI()
print("Login success:", bf.login())
print("Session token:", bf.session_token)
print("Live markets:", bf.list_live_markets())
