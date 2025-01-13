import os
from pathlib import Path
import toml

CONFIG_DIR = Path(os.path.expanduser("~/.cache/cygnus"))
CONFIG_FILE = CONFIG_DIR / "config.toml"


def load_config():
    if not CONFIG_DIR.exists():
        CONFIG_DIR.mkdir(parents=True)

    if not CONFIG_FILE.exists():
        # Create default config
        config = {"database": {"url": f"sqlite:///{CONFIG_DIR}/cygnus.db"}}
        CONFIG_FILE.write_text(toml.dumps(config))
        return config

    return toml.load(CONFIG_FILE)


config = load_config()
DATABASE_URL = config["database"]["url"]
