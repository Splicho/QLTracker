import json
from datetime import datetime, timezone
import urllib.request
import urllib.error

import minqlx


class pickup_bridge(minqlx.Plugin):
    def __init__(self):
        super().__init__()
        self.add_command("reloadpickup", self.cmd_reloadpickup, 5)
        self.add_hook("map", self.handle_map)
        self.add_hook("player_connect", self.handle_player_connect, priority=minqlx.PRI_HIGH)
        self.add_hook("player_loaded", self.handle_player_loaded)
        self.add_hook("team_switch_attempt", self.handle_team_switch_attempt, priority=minqlx.PRI_HIGH)
        self.add_hook("game_start", self.handle_game_start)
        self.add_hook("game_end", self.handle_game_end)
        self.add_hook("round_start", self.handle_round_start)
        self.add_hook("chat", self.handle_chat)
        self.add_hook("console_print", self.handle_console_print)

        self.ready_reported = False
        self.live_reported = False
        self.live_reporting = False
        self.completed_reported = False
        self.completed_reporting = False
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

    def reload_metadata(self):
        self.metadata = self.load_metadata()
        self.populate_roster()

    def apply_roster(self):
        for player in self.players():
            steam_id = self.parse_steam_id(player)
            if steam_id is None:
                continue

            target_team = self.allowed_players.get(steam_id)
            try:
                if target_team:
                    if player.team != target_team:
                        player.put(target_team)
                elif player.team != "spectator":
                    player.put("spectator")
            except Exception as error:
                self.logger.warning(
                    "failed to apply pickup roster for %s: %s",
                    player.clean_name,
                    error,
                )

    def populate_roster(self):
        self.match_id = self.metadata.get("matchId")
        self.callback_url = self.metadata.get("callbackBaseUrl")
        self.callback_token = self.metadata.get("callbackToken")
        self.allowed_players = {}

        for player in self.metadata.get("teams", {}).get("red", []):
            self.allowed_players[int(player["steamId"])] = "red"

        for player in self.metadata.get("teams", {}).get("blue", []):
            self.allowed_players[int(player["steamId"])] = "blue"

    def cmd_reloadpickup(self, _player, _msg, _channel):
        try:
            self.reload_metadata()
            self.apply_roster()
        except Exception as error:
            self.logger.error("failed to reload pickup metadata: %s", error)
            self.msg("^1[QLTRACKER] ^7Failed to reload pickup metadata.")
            return minqlx.RET_STOP_ALL

        self.msg("^1[QLTRACKER] ^7Pickup metadata reloaded.")
        return minqlx.RET_STOP_ALL

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
            self.logger.info("reported ready state")
        except urllib.error.URLError as error:
            self.logger.error("failed to report ready state: %s", error)

    @minqlx.thread
    def report_live(self, trigger):
        if self.live_reported or self.live_reporting:
            return

        self.live_reporting = True
        try:
            self.post_json("live", {})
            self.live_reported = True
            self.logger.info("reported live state via %s", trigger)
        except urllib.error.URLError as error:
            self.live_reported = False
            self.logger.error("failed to report live state via %s: %s", trigger, error)
        except Exception as error:
            self.live_reported = False
            self.logger.error("failed to report live state via %s: %s", trigger, error)
        finally:
            self.live_reporting = False

    def handle_game_start(self, *_args):
        self.report_live("game_start")

    def handle_round_start(self, _round_number):
        self.report_live("round_start")

    @minqlx.thread
    def report_chat(self, player, message, channel_name):
        steam_id = self.parse_steam_id(player)
        if not message:
            return

        prefix = self.get_cvar("qlx_commandPrefix") or "!"
        if message.startswith(prefix):
            return

        player_name = getattr(player, "name", None) or player.clean_name

        try:
            self.post_json(
                "chat",
                {
                    "channel": channel_name,
                    "message": message,
                    "playerName": player_name,
                    "playerSteamId": str(steam_id) if steam_id is not None else None,
                    "sentAt": datetime.now(timezone.utc).isoformat(),
                },
            )
        except urllib.error.URLError as error:
            self.logger.error("failed to post chat event: %s", error)
        except Exception as error:
            self.logger.error("failed to post chat event: %s", error)

    def handle_chat(self, player, msg, channel):
        channel_name = getattr(channel, "name", None) or str(channel)
        self.report_chat(player, msg.strip(), channel_name)

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

    def resolve_scores(self, data=None):
        red_score = None
        blue_score = None
        try:
            if self.game:
                red_score = self.game.red_score
                blue_score = self.game.blue_score
        except Exception:
            red_score = None
            blue_score = None

        if (red_score is None or blue_score is None) and data is not None:
            red_score = int(data.get("TSCORE0", 0))
            blue_score = int(data.get("TSCORE1", 0))

        return red_score, blue_score

    def infer_winner_from_text(self, text):
        normalized = text.lower()
        if "hit the roundlimit" not in normalized and "hit the fraglimit" not in normalized:
            return None

        if "blue" in normalized:
            return "right"

        if "red" in normalized:
            return "left"

        return None

    @minqlx.thread
    def report_completed(self, trigger, winner_team=None, final_score=None):
        if self.completed_reported or self.completed_reporting:
            return

        self.completed_reporting = True
        try:
            red_score, blue_score = self.resolve_scores()
            if final_score is None and red_score is not None and blue_score is not None:
                final_score = f"{red_score}-{blue_score}"

            if winner_team is None and red_score is not None and blue_score is not None:
                winner_team = "left" if red_score >= blue_score else "right"

            if winner_team is None:
                self.logger.error("failed to report match result via %s: winner could not be resolved", trigger)
                return

            self.post_json(
                "completed",
                {
                    "winnerTeam": winner_team,
                    "finalScore": final_score,
                },
            )
            self.completed_reported = True
            self.logger.info(
                "reported match result via %s: winner=%s final_score=%s",
                trigger,
                winner_team,
                final_score,
            )
        except urllib.error.URLError as error:
            self.completed_reported = False
            self.logger.error("failed to post match result via %s: %s", trigger, error)
        except Exception as error:
            self.completed_reported = False
            self.logger.error("failed to post match result via %s: %s", trigger, error)
        finally:
            self.completed_reporting = False

    def handle_game_end(self, data):
        if data.get("ABORTED"):
            return

        red_score, blue_score = self.resolve_scores(data)
        winner_team = None
        final_score = None
        if red_score is not None and blue_score is not None:
            winner_team = "left" if red_score >= blue_score else "right"
            final_score = f"{red_score}-{blue_score}"

        self.report_completed("game_end", winner_team, final_score)

    def handle_console_print(self, text):
        winner_team = self.infer_winner_from_text(text)
        if winner_team is None:
            return

        self.report_completed("console_print", winner_team)
