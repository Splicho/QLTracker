import json
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from functools import partial

import minqlx


class RconHandler(BaseHTTPRequestHandler):
    def __init__(self, token, plugin, *args, **kwargs):
        self.token = token
        self.plugin = plugin
        super().__init__(*args, **kwargs)

    def log_message(self, format, *args):
        pass

    def _check_auth(self):
        auth = self.headers.get("Authorization", "")
        if auth != f"Bearer {self.token}":
            self.send_response(401)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "error": "Unauthorized"}).encode())
            return False
        return True

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def _send_json(self, status, data):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_POST(self):
        if not self._check_auth():
            return

        try:
            body = self._read_body()
        except Exception:
            self._send_json(400, {"ok": False, "error": "Invalid JSON body"})
            return

        path = self.path.rstrip("/")

        if path == "/kick":
            self._handle_kick(body)
        elif path == "/ban":
            self._handle_ban(body)
        elif path == "/say":
            self._handle_say(body)
        elif path == "/cmd":
            self._handle_cmd(body)
        else:
            self._send_json(404, {"ok": False, "error": "Unknown endpoint"})

    def _find_player(self, steam_id):
        try:
            sid = int(steam_id)
            for player in self.plugin.players():
                if player.steam_id == sid:
                    return player
        except (TypeError, ValueError):
            pass
        return None

    def _handle_kick(self, body):
        steam_id = body.get("steamId")
        if not steam_id:
            self._send_json(400, {"ok": False, "error": "steamId required"})
            return

        player = self._find_player(steam_id)
        if not player:
            self._send_json(404, {"ok": False, "error": "Player not found on server"})
            return

        try:
            player.kick(body.get("reason", "Kicked by admin"))
            self._send_json(200, {"ok": True})
        except Exception as e:
            self._send_json(500, {"ok": False, "error": str(e)})

    def _handle_ban(self, body):
        steam_id = body.get("steamId")
        if not steam_id:
            self._send_json(400, {"ok": False, "error": "steamId required"})
            return

        player = self._find_player(steam_id)
        if player:
            try:
                player.ban()
                self._send_json(200, {"ok": True})
                return
            except Exception as e:
                self._send_json(500, {"ok": False, "error": str(e)})
                return

        try:
            minqlx.console_command(f"ban {steam_id}")
            self._send_json(200, {"ok": True})
        except Exception as e:
            self._send_json(500, {"ok": False, "error": str(e)})

    def _handle_say(self, body):
        message = body.get("message")
        if not message:
            self._send_json(400, {"ok": False, "error": "message required"})
            return

        try:
            minqlx.CHAT_CHANNEL.reply(f"^3[ADMIN] ^7{message}")
            self._send_json(200, {"ok": True})
        except Exception as e:
            self._send_json(500, {"ok": False, "error": str(e)})

    def _handle_cmd(self, body):
        command = body.get("command")
        if not command:
            self._send_json(400, {"ok": False, "error": "command required"})
            return

        try:
            minqlx.console_command(command)
            self._send_json(200, {"ok": True})
        except Exception as e:
            self._send_json(500, {"ok": False, "error": str(e)})


class qltracker_rcon(minqlx.Plugin):
    def __init__(self):
        super().__init__()
        self.server = None
        self.server_thread = None

        port = self.get_cvar("qlx_rconPort")
        token = self.get_cvar("qlx_rconToken")

        if not port or not token:
            self.logger.warning("qltracker_rcon: missing qlx_rconPort or qlx_rconToken, skipping")
            return

        port = int(port)
        handler = partial(RconHandler, token, self)

        try:
            self.server = HTTPServer(("127.0.0.1", port), handler)
            self.server_thread = threading.Thread(target=self.server.serve_forever, daemon=True)
            self.server_thread.start()
            self.logger.info("qltracker_rcon: listening on 127.0.0.1:%s", port)
        except Exception as e:
            self.logger.error("qltracker_rcon: failed to start HTTP server: %s", e)
