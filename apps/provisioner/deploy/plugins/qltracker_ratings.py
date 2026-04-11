import json

import minqlx


PREFIX = "^1[QLTRACKER] ^7"


class qltracker_ratings(minqlx.Plugin):
    def __init__(self):
        super().__init__()
        self.metadata = {}
        self.roster_by_steam_id = {}
        self.teams = {"red": [], "blue": []}
        self.add_command("rating", self.cmd_rating)
        self.add_command("ratings", self.cmd_ratings)
        self.refresh_metadata()

    @staticmethod
    def normalize_steam_id(value):
        if value is None:
            return None

        try:
            normalized = str(value).strip()
            if not normalized:
                return None

            return str(int(normalized))
        except (TypeError, ValueError):
            return None

    @classmethod
    def parse_steam_id(cls, player):
        return cls.normalize_steam_id(getattr(player, "steam_id", None))

    @staticmethod
    def parse_rating(value):
        if isinstance(value, bool):
            return None

        try:
            rating = int(value)
        except (TypeError, ValueError):
            return None

        if rating < 0:
            return None

        return rating

    def load_metadata(self):
        metadata_file = self.get_cvar("qlx_pickupMetadataFile")
        if not metadata_file:
            self.logger.warning("pickup metadata file is missing; ratings unavailable")
            return {}

        try:
            with open(metadata_file, "r", encoding="utf-8") as handle:
                return json.load(handle)
        except Exception as error:
            self.logger.warning("failed to load pickup metadata for ratings: %s", error)
            return {}

    def refresh_metadata(self):
        self.metadata = self.load_metadata()
        self.roster_by_steam_id = {}
        self.teams = {"red": [], "blue": []}

        metadata_teams = self.metadata.get("teams", {})
        if not isinstance(metadata_teams, dict):
            return

        for team in ("red", "blue"):
            players = metadata_teams.get(team, [])
            if not isinstance(players, list):
                continue

            for player in players:
                if not isinstance(player, dict):
                    continue

                steam_id = self.normalize_steam_id(player.get("steamId"))
                if steam_id is None:
                    continue

                roster_player = {
                    "display_rating": self.parse_rating(player.get("displayRating")),
                    "name": str(player.get("personaName") or steam_id),
                    "steam_id": steam_id,
                    "team": team,
                }
                self.roster_by_steam_id[steam_id] = roster_player
                self.teams[team].append(roster_player)

    def queue_name(self):
        queue = self.metadata.get("queue")
        if isinstance(queue, dict):
            name = queue.get("name")
            if isinstance(name, str) and name.strip():
                return name.strip()

        team_size = max(len(self.teams.get("red", [])), len(self.teams.get("blue", [])))
        if team_size > 0:
            return f"{team_size}v{team_size} CA"

        return "pickup"

    def rating_queue_label(self):
        queue_name = self.queue_name()
        if queue_name.lower().endswith(" ca"):
            return queue_name[:-3].strip()

        return queue_name

    @staticmethod
    def format_rating(player):
        rating = player.get("display_rating")
        if rating is None:
            return "^7unrated"

        return f"^7{rating}"

    def format_player_rating(self, player):
        return f'{player["name"]} {self.format_rating(player)}'

    def reply(self, channel, message):
        try:
            channel.reply(message)
        except Exception:
            self.msg(message)

    def cmd_rating(self, player, _msg, channel):
        self.refresh_metadata()
        steam_id = self.parse_steam_id(player)
        if steam_id is None:
            player.tell(f"{PREFIX}Could not resolve your Steam ID.")
            return minqlx.RET_STOP_ALL

        roster_player = self.roster_by_steam_id.get(steam_id)
        if roster_player is None:
            player.tell(f"{PREFIX}No pickup rating is available for you on this server.")
            return minqlx.RET_STOP_ALL

        self.reply(
            channel,
            (
                f"{PREFIX}{roster_player['name']} current "
                f"{self.rating_queue_label()} rating is {self.format_rating(roster_player)}"
            ),
        )
        return minqlx.RET_STOP_ALL

    def cmd_ratings(self, _player, _msg, channel):
        self.refresh_metadata()
        if not self.teams["red"] and not self.teams["blue"]:
            self.reply(channel, f"{PREFIX}No pickup ratings are available on this server.")
            return minqlx.RET_STOP_ALL

        self.reply(channel, f"{PREFIX}Current {self.queue_name()} ratings")
        for team, label in (("red", "^1Red"), ("blue", "^4Blue")):
            ratings = ", ".join(
                self.format_player_rating(player) for player in self.teams[team]
            )
            self.reply(channel, f"{label}^7: {ratings or 'none'}")

        return minqlx.RET_STOP_ALL
