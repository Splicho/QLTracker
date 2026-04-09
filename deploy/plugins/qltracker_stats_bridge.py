import json
import urllib.error
import urllib.request

import minqlx


class qltracker_stats_bridge(minqlx.Plugin):
    def __init__(self):
        super().__init__()
        self.add_hook("game_start", self.handle_game_start)
        self.add_hook("game_end", self.handle_game_end)

    def build_payload(self, kind):
        game = self.game
        if not game:
            return None

        players = []
        for player in self.players():
            try:
                players.append(
                    {
                        "name": getattr(player, "clean_name", None) or getattr(player, "name", None),
                        "steamId": str(getattr(player, "steam_id", "")),
                        "team": getattr(player, "team", None),
                    }
                )
            except Exception:
                continue

        return {
            "factory": getattr(game, "factory", None),
            "gameType": getattr(game, "type_short", None),
            "kind": kind,
            "map": getattr(game, "map", None),
            "matchId": self.get_cvar("qlx_pickupMatchId"),
            "players": players,
            "redScore": getattr(game, "red_score", None),
            "blueScore": getattr(game, "blue_score", None),
            "token": self.get_cvar("qlx_pickupBridgeToken"),
        }

    def post_payload(self, payload):
        url = self.get_cvar("qlx_pickupStatsUrl")
        if not url:
            return

        request = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=10):
            return

    @minqlx.thread
    def handle_game_start(self, *_args):
        payload = self.build_payload("start")
        if not payload:
            return

        try:
            self.post_payload(payload)
        except urllib.error.URLError as error:
            self.logger.error("failed to post start supplemental stats: %s", error)
        except Exception as error:
            self.logger.error("failed to post start supplemental stats: %s", error)

    @minqlx.thread
    def handle_game_end(self, data):
        if data and data.get("ABORTED"):
            return

        payload = self.build_payload("end")
        if not payload:
            return

        try:
            self.post_payload(payload)
        except urllib.error.URLError as error:
            self.logger.error("failed to post end supplemental stats: %s", error)
        except Exception as error:
            self.logger.error("failed to post end supplemental stats: %s", error)
