import json
import urllib.request
import urllib.error

import minqlx


class pickup_bridge(minqlx.Plugin):
    def __init__(self):
        super().__init__()
        self.add_hook("map", self.handle_map)
        self.add_hook("player_connect", self.handle_player_connect, priority=minqlx.PRI_HIGH)
        self.add_hook("player_loaded", self.handle_player_loaded)
        self.add_hook("team_switch_attempt", self.handle_team_switch_attempt, priority=minqlx.PRI_HIGH)
        self.add_hook("game_start", self.handle_game_start)
        self.add_hook("game_end", self.handle_game_end)

        self.ready_reported = False
        self.live_reported = False
        self.metadata = self.load_metadata()
        self.allowed_players = {}
        self.match_id = None
        self.callback_url = None
        self.callback_token = None
        self.populate_roster()

    @staticmethod
    def parse_steam_id(player):
        try:
            steam_id = getattr(player, "steam_id", None)
            if steam_id is None:
                return None
            return int(steam_id)
        except (TypeError, ValueError):
            return None

    def load_metadata(self):
        metadata_file = self.get_cvar("qlx_pickupMetadataFile")
        if not metadata_file:
            self.logger.error("pickup metadata file is missing")
            return {}

        with open(metadata_file, "r", encoding="utf-8") as handle:
            return json.load(handle)

    def populate_roster(self):
        self.match_id = self.metadata.get("matchId")
        self.callback_url = self.metadata.get("callbackBaseUrl")
        self.callback_token = self.metadata.get("callbackToken")
        self.allowed_players = {}

        for player in self.metadata.get("teams", {}).get("red", []):
            self.allowed_players[int(player["steamId"])] = "red"

        for player in self.metadata.get("teams", {}).get("blue", []):
            self.allowed_players[int(player["steamId"])] = "blue"

    def post_json(self, suffix, payload):
        if not self.callback_url or not self.callback_token:
            self.logger.error("pickup bridge callback configuration is missing")
            return

        body = {
            **payload,
            "matchId": self.match_id,
            "token": self.callback_token,
        }
        encoded = json.dumps(body).encode("utf-8")
        request = urllib.request.Request(
            f"{self.callback_url}/{suffix}",
            data=encoded,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=10):
            return

    @minqlx.delay(3)
    def handle_map(self, _mapname, _factory):
        if self.ready_reported:
            return

        try:
            self.post_json("ready", {})
            self.ready_reported = True
        except urllib.error.URLError as error:
            self.logger.error("failed to report ready state: %s", error)

    @minqlx.thread
    def handle_game_start(self, *_args):
        if self.live_reported:
            return

        try:
            self.post_json("live", {})
            self.live_reported = True
        except urllib.error.URLError as error:
            self.logger.error("failed to report live state: %s", error)

    def handle_player_connect(self, player):
        steam_id = self.parse_steam_id(player)
        if steam_id is None:
            self.logger.info("player connected without resolved steam_id yet: %s", player.clean_name)
            return

        if steam_id not in self.allowed_players:
            self.logger.info("allowing spectator connection for non-roster player %s (%s)", player.clean_name, steam_id)

    @minqlx.delay(1)
    def handle_player_loaded(self, player):
        steam_id = self.parse_steam_id(player)
        if steam_id is None:
            return

        team = self.allowed_players.get(steam_id)
        if team:
            try:
                player.put(team)
            except Exception as error:
                self.logger.warning("failed to place player %s onto %s: %s", player.clean_name, team, error)
            return

        try:
            if player.team != "spectator":
                player.put("spectator")
        except Exception as error:
            self.logger.warning("failed to move non-roster player %s to spectator: %s", player.clean_name, error)

    def handle_team_switch_attempt(self, player, _old_team, new_team):
        steam_id = self.parse_steam_id(player)
        if steam_id is None:
            return

        target_team = self.allowed_players.get(steam_id)
        if not target_team:
            if new_team in {"red", "blue", "free", "any"}:
                player.tell("^1[QLTRACKER] ^7This server is locked to the active pickup roster. Spectators are welcome.")
                return False
            return

        if new_team == target_team:
            return

        @minqlx.next_frame
        def force_team():
            try:
                player.put(target_team)
            except Exception as error:
                self.logger.warning("failed to force player %s onto %s: %s", player.clean_name, target_team, error)

        force_team()
        return False

    @minqlx.thread
    def handle_game_end(self, data):
        if data.get("ABORTED"):
            return

        red_score = None
        blue_score = None
        try:
            if self.game:
                red_score = self.game.red_score
                blue_score = self.game.blue_score
        except Exception:
            red_score = None
            blue_score = None

        if red_score is None or blue_score is None:
            red_score = int(data.get("TSCORE0", 0))
            blue_score = int(data.get("TSCORE1", 0))

        winner_team = "left" if red_score >= blue_score else "right"
        final_score = f"{red_score}-{blue_score}"

        try:
            self.post_json(
                "completed",
                {
                    "winnerTeam": winner_team,
                    "finalScore": final_score,
                },
            )
        except urllib.error.URLError as error:
            self.logger.error("failed to post match result: %s", error)
