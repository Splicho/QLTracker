import json

import minqlx


class qltracker_sort(minqlx.Plugin):
    def __init__(self):
        super().__init__()
        self.allowed_players = {}
        self.add_command("sort", self.cmd_sort, 5)
        self.load_roster()

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
            raise ValueError("pickup metadata file is missing")

        with open(metadata_file, "r", encoding="utf-8") as handle:
            return json.load(handle)

    def load_roster(self):
        metadata = self.load_metadata()
        allowed_players = {}

        for player in metadata.get("teams", {}).get("red", []):
            allowed_players[int(player["steamId"])] = "red"

        for player in metadata.get("teams", {}).get("blue", []):
            allowed_players[int(player["steamId"])] = "blue"

        self.allowed_players = allowed_players

    def sort_connected_players(self):
        for player in self.players():
            steam_id = self.parse_steam_id(player)
            if steam_id is None:
                continue

            target_team = self.allowed_players.get(steam_id)
            if not target_team:
                continue

            try:
                player.put(target_team)
            except Exception as error:
                self.logger.warning(
                    "failed to sort player %s onto %s: %s",
                    player.clean_name,
                    target_team,
                    error,
                )

    def cmd_sort(self, _player, _msg, _channel):
        self.msg("^1[QLTRACKER] ^7Sorting teams...")

        try:
            self.load_roster()
            self.sort_connected_players()
        except Exception as error:
            self.logger.error("failed to sort teams from pickup metadata: %s", error)
            self.msg("^1[QLTRACKER] ^7Failed to sort teams.")
            return minqlx.RET_STOP_ALL

        self.msg("^1[QLTRACKER] ^7Teams sorted successfully!")
        return minqlx.RET_STOP_ALL
