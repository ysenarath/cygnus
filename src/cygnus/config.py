"""
Configuration module using structured configs with dataclasses.

This module defines the application configuration structure using
dataclasses and provides a function to load and validate the config.
"""

from dataclasses import dataclass
from pathlib import Path
from omegaconf import OmegaConf


@dataclass
class AppConfig:
    """
    Application configuration.

    Parameters
    ----------
    name : str
        Application name.
    host : str
        Application host address.
    port : int
        Application port number.
    scheme : str
        URL scheme (http or https).
    """

    name: str
    host: str
    port: int
    scheme: str


@dataclass
class DatabaseConfig:
    """
    Database configuration.

    Parameters
    ----------
    url : str
        Database connection URL.
    echo : bool
        Whether to echo SQL statements.
    """

    url: str
    echo: bool


@dataclass
class ApiConfig:
    """
    API configuration.

    Parameters
    ----------
    host : str
        API host address.
    port : int
        API port number.
    debug : bool
        Whether to run in debug mode.
    scheme : str
        URL scheme (http or https).
    """

    host: str
    port: int
    debug: bool
    scheme: str


@dataclass
class SecurityConfig:
    """
    Security configuration.

    Parameters
    ----------
    secret_key : str
        Secret key for sessions and tokens.
    """

    secret_key: str
    jwt_secret_key: str
    jwt_access_token_expires: int
    jwt_refresh_token_expires: int
    jwt_algorithm: str


@dataclass
class Config:
    """
    Main configuration class.

    Parameters
    ----------
    app : AppConfig
        Application configuration.
    database : DatabaseConfig
        Database configuration.
    api : ApiConfig
        API configuration.
    security : SecurityConfig
        Security configuration.
    """

    app: AppConfig
    database: DatabaseConfig
    api: ApiConfig
    security: SecurityConfig


def load_config(path: Path | str | None = None) -> Config:
    """
    Load configuration from YAML file.

    Parameters
    ----------
    path : Path | str | None, optional
        Path to configuration file. If None, uses default path.

    Returns
    -------
    Config
        Structured configuration object.

    Raises
    ------
    FileNotFoundError
        If configuration file does not exist.

    Examples
    --------
    >>> config = load_config()
    >>> print(config.app.name)
    Cygnus
    """
    if path is None:
        path = Path(__file__).parent.parent.parent / "config" / "config.yaml"
    else:
        path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Configuration file not found: {path}")
    # Load YAML config
    yaml_config = OmegaConf.load(path)
    # Create structured config from schema
    schema = OmegaConf.structured(Config)
    # Merge with loaded config
    config = OmegaConf.merge(schema, yaml_config)
    # Convert to Config object
    return OmegaConf.to_object(config)
