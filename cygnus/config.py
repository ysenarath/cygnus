import os
from pathlib import Path
import toml

CONFIG_DIR = Path(os.path.expanduser("~/.cache/cygnus"))
CONFIG_FILE = CONFIG_DIR / "config.toml"


# Create embeddings directory
EMBEDDINGS_DIR = CONFIG_DIR / "embeddings"
if not EMBEDDINGS_DIR.exists():
    EMBEDDINGS_DIR.mkdir(parents=True)


def load_config():
    if not CONFIG_DIR.exists():
        CONFIG_DIR.mkdir(parents=True)

    if not CONFIG_FILE.exists():
        # Create default config
        config = {
            "database": {"url": f"sqlite:///{CONFIG_DIR}/cygnus.db"},
            "embeddings": {
                "model": "sentence-transformers/all-MiniLM-L6-v2",
                "device": "cpu",
                "batch_size": 32,
                "max_length": 512,
            },
            "index": {"metric": "cosine", "ef_construction": 200, "M": 16},
        }
        CONFIG_FILE.write_text(toml.dumps(config))
        return config

    return toml.load(CONFIG_FILE)


config = load_config()
DATABASE_URL = config["database"]["url"]
