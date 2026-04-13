import json
import os

import minqlx


PREFIX = "^1[QLTRACKER] ^7"
TEAM_ALIASES = {
    "any": "any",
    "b": "blue",
    "blue": "blue",
    "r": "red",
    "red": "red",
}


class qltracker_spawns(minqlx.Plugin):
    def __init__(self):
        super().__init__()
        self.set_cvar_once("qlx_customSpawnsEnabled", "1")
        self.set_cvar_once("qlx_customSpawnsFile", "custom_spawns.json")
        self.set_cvar_once("qlx_customSpawnsResetVelocity", "1")
        self.set_cvar_once("qlx_customSpawnsWarmup", "0")

        self.spawn_data = self.load_spawn_data()
        self.used_spawns = {"any": set(), "blue": set(), "red": set()}
        self.round_serial = 0

        self.add_hook("map", self.handle_map)
        self.add_hook("new_game", self.handle_new_game)
        self.add_hook("round_start", self.handle_round_start)
        self.add_hook("player_spawn", self.handle_player_spawn)

        self.add_command("savepos", self.cmd_savepos, 5, usage="<name> [map] [red|blue|any]")
        self.add_command("delpos", self.cmd_delpos, 5, usage="<name> [map] [red|blue|any]")
        self.add_command("listpos", self.cmd_listpos, 5, usage="[map]")
        self.add_command("reloadspawns", self.cmd_reloadspawns, 5)
        self.add_command("spawnsexport", self.cmd_spawnsexport, 5)

    def reply(self, channel, message):
        try:
            channel.reply(message)
        except Exception:
            self.msg(message)

    def custom_spawns_file(self):
        configured = self.get_cvar("qlx_customSpawnsFile") or "custom_spawns.json"
        if os.path.isabs(configured):
            return configured

        fs_homepath = self.get_cvar("fs_homepath") or os.getcwd()
        return os.path.join(fs_homepath, "baseq3", configured)

    @staticmethod
    def empty_spawn_data():
        return {"version": 1, "maps": {}}

    def load_spawn_data(self):
        path = self.custom_spawns_file()
        if not os.path.exists(path):
            return self.empty_spawn_data()

        try:
            with open(path, "r", encoding="utf-8") as handle:
                data = json.load(handle)
        except Exception as error:
            self.logger.error("failed to load custom spawns from %s: %s", path, error)
            return self.empty_spawn_data()

        if isinstance(data, dict) and isinstance(data.get("maps"), dict):
            return data

        if isinstance(data, dict):
            return {"version": 1, "maps": data}

        return self.empty_spawn_data()

    def save_spawn_data(self):
        path = self.custom_spawns_file()
        os.makedirs(os.path.dirname(path), exist_ok=True)
        tmp_path = f"{path}.tmp"

        with open(tmp_path, "w", encoding="utf-8") as handle:
            json.dump(self.spawn_data, handle, indent=2, sort_keys=True)
            handle.write("\n")

        os.replace(tmp_path, path)

    def normalize_map(self, value=None):
        raw = value
        if raw is None:
            game = self.game
            raw = getattr(game, "map", None) if game else None
        if not raw:
            raw = self.get_cvar("mapname")

        return str(raw or "").strip().lower()

    @staticmethod
    def normalize_team(value):
        return TEAM_ALIASES.get(str(value or "").strip().lower())

    def infer_team(self, player, name, explicit_team=None):
        normalized = self.normalize_team(explicit_team)
        if normalized:
            return normalized

        name_value = str(name or "").strip().lower()
        for prefix in ("red", "blue"):
            if name_value == prefix or name_value.startswith(prefix):
                return prefix

        player_team = getattr(player, "team", None)
        if player_team in ("red", "blue"):
            return player_team

        return "any"

    def map_bucket(self, map_name):
        maps = self.spawn_data.setdefault("maps", {})
        bucket = maps.setdefault(map_name, {})
        for team in ("red", "blue", "any"):
            positions = bucket.get(team)
            if not isinstance(positions, list):
                bucket[team] = []

        return bucket

    @staticmethod
    def parse_position(player):
        position = player.position()
        return [round(float(position.x), 3), round(float(position.y), 3), round(float(position.z), 3)]

    def parse_command_target(self, player, msg):
        if len(msg) < 2:
            return None, None, None

        name = str(msg[1]).strip()
        map_name = self.normalize_map()
        team = None

        if len(msg) >= 3:
            maybe_team = self.normalize_team(msg[2])
            if maybe_team:
                team = maybe_team
            else:
                map_name = self.normalize_map(msg[2])

        if len(msg) >= 4:
            team = self.normalize_team(msg[3])

        return name, map_name, self.infer_team(player, name, team)

    def current_map_positions(self):
        map_name = self.normalize_map()
        maps = self.spawn_data.get("maps", {})
        bucket = maps.get(map_name)
        return map_name, bucket if isinstance(bucket, dict) else None

    def enabled(self):
        try:
            return self.get_cvar("qlx_customSpawnsEnabled", bool)
        except Exception:
            return True

    def allow_warmup(self):
        try:
            return self.get_cvar("qlx_customSpawnsWarmup", bool)
        except Exception:
            return False

    def should_override_spawn(self, player):
        if not self.enabled():
            return False

        if getattr(player, "team", None) not in ("red", "blue"):
            return False

        game = self.game
        state = getattr(game, "state", None) if game else None
        if state in ("in_progress", "countdown"):
            return True

        return self.allow_warmup()

    def reset_round_usage(self):
        self.used_spawns = {"any": set(), "blue": set(), "red": set()}
        self.round_serial += 1

    def handle_map(self, *_args):
        self.spawn_data = self.load_spawn_data()
        self.reset_round_usage()

    def handle_new_game(self, *_args):
        self.reset_round_usage()

    def handle_round_start(self, *_args):
        self.reset_round_usage()

    def choose_spawn(self, map_name, team):
        maps = self.spawn_data.get("maps", {})
        bucket = maps.get(map_name)
        if not isinstance(bucket, dict):
            return None

        team_positions = bucket.get(team) if isinstance(bucket.get(team), list) else []
        any_positions = bucket.get("any") if isinstance(bucket.get("any"), list) else []
        candidates = [(team, position) for position in team_positions]
        candidates.extend(("any", position) for position in any_positions)

        if not candidates:
            return None

        for source_team, position in candidates:
            name = str(position.get("name") or "")
            key = f"{source_team}:{name}"
            if key not in self.used_spawns.setdefault(source_team, set()):
                self.used_spawns[source_team].add(key)
                return position

        source_team, position = candidates[0]
        name = str(position.get("name") or "")
        self.used_spawns.setdefault(source_team, set()).add(f"{source_team}:{name}")
        return position

    def handle_player_spawn(self, player):
        if not self.should_override_spawn(player):
            return

        self.apply_custom_spawn(player.id, getattr(player, "team", None), self.round_serial)

    @minqlx.delay(0.05)
    def apply_custom_spawn(self, player_id, team, round_serial):
        if round_serial != self.round_serial:
            return

        player = self.player(player_id)
        if not player or getattr(player, "team", None) != team:
            return

        map_name = self.normalize_map()
        spawn = self.choose_spawn(map_name, team)
        if not spawn:
            return

        origin = spawn.get("origin")
        if not isinstance(origin, list) or len(origin) != 3:
            return

        try:
            x, y, z = (float(origin[0]), float(origin[1]), float(origin[2]))
            player.position(x=x, y=y, z=z)
            if self.get_cvar("qlx_customSpawnsResetVelocity", bool):
                player.velocity(reset=True)
        except Exception as error:
            self.logger.warning(
                "failed to apply custom spawn %s on %s to %s: %s",
                spawn.get("name"),
                map_name,
                player.clean_name,
                error,
            )

    def cmd_savepos(self, player, msg, channel):
        name, map_name, team = self.parse_command_target(player, msg)
        if not name:
            self.reply(channel, f"{PREFIX}Usage: !savepos <name> [map] [red|blue|any]")
            return minqlx.RET_STOP_ALL

        bucket = self.map_bucket(map_name)
        positions = bucket[team]
        origin = self.parse_position(player)
        entry = {"name": name, "origin": origin}

        for index, existing in enumerate(positions):
            if str(existing.get("name") or "").lower() == name.lower():
                positions[index] = entry
                break
        else:
            positions.append(entry)

        self.save_spawn_data()
        self.reply(
            channel,
            f"{PREFIX}Saved {team} spawn ^5{name}^7 for ^5{map_name}^7 at {origin}.",
        )
        return minqlx.RET_STOP_ALL

    def cmd_delpos(self, player, msg, channel):
        name, map_name, team = self.parse_command_target(player, msg)
        if not name:
            self.reply(channel, f"{PREFIX}Usage: !delpos <name> [map] [red|blue|any]")
            return minqlx.RET_STOP_ALL

        bucket = self.map_bucket(map_name)
        before = len(bucket[team])
        bucket[team] = [
            position
            for position in bucket[team]
            if str(position.get("name") or "").lower() != name.lower()
        ]

        if len(bucket[team]) == before:
            self.reply(channel, f"{PREFIX}No {team} spawn named ^5{name}^7 on ^5{map_name}^7.")
            return minqlx.RET_STOP_ALL

        self.save_spawn_data()
        self.reply(channel, f"{PREFIX}Deleted {team} spawn ^5{name}^7 from ^5{map_name}^7.")
        return minqlx.RET_STOP_ALL

    def cmd_listpos(self, _player, msg, channel):
        map_name = self.normalize_map(msg[1]) if len(msg) >= 2 else self.normalize_map()
        bucket = self.spawn_data.get("maps", {}).get(map_name)
        if not isinstance(bucket, dict):
            self.reply(channel, f"{PREFIX}No custom spawns saved for ^5{map_name}^7.")
            return minqlx.RET_STOP_ALL

        parts = []
        for team in ("red", "blue", "any"):
            names = [
                str(position.get("name") or "?")
                for position in bucket.get(team, [])
                if isinstance(position, dict)
            ]
            parts.append(f"{team}: {', '.join(names) if names else '-'}")

        self.reply(channel, f"{PREFIX}{map_name} spawns - {' | '.join(parts)}")
        return minqlx.RET_STOP_ALL

    def cmd_reloadspawns(self, _player, _msg, channel):
        self.spawn_data = self.load_spawn_data()
        self.reset_round_usage()
        self.reply(channel, f"{PREFIX}Reloaded custom spawns from {self.custom_spawns_file()}.")
        return minqlx.RET_STOP_ALL

    def cmd_spawnsexport(self, _player, _msg, channel):
        self.save_spawn_data()
        count = 0
        for bucket in self.spawn_data.get("maps", {}).values():
            if not isinstance(bucket, dict):
                continue
            for team in ("red", "blue", "any"):
                positions = bucket.get(team, [])
                if isinstance(positions, list):
                    count += len(positions)

        self.reply(
            channel,
            f"{PREFIX}Exported {count} custom spawns to {self.custom_spawns_file()}.",
        )
        return minqlx.RET_STOP_ALL
