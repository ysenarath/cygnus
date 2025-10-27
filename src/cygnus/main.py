"""
Main CLI entry point for Cygnus application.

This module provides command-line interface for various Cygnus operations.
"""

import json
from pathlib import Path

import click
from omegaconf import OmegaConf


@click.group()
@click.version_option()
def cli():
    """
    Cygnus CLI - Command-line interface for Cygnus application.

    Notes
    -----
    Use --help with any command to see detailed usage information.
    """
    pass


@cli.command()
def setup():
    """
    Generate frontend configuration file from YAML config.

    Notes
    -----
    Reads the main config.yaml and extracts frontend-relevant settings
    to create a JavaScript config file at frontend/src/config/config.js.

    Examples
    --------
    >>> cygnus generate-frontend-config
    Frontend config generated at frontend/src/config/config.js
    """
    # Load the main configuration
    config_path = Path.cwd() / "config" / "config.yaml"

    if not config_path.exists():
        click.echo(f"Error: Configuration file not found at {config_path}", err=True)
        raise click.Abort()

    try:
        config = OmegaConf.load(config_path)
    except Exception as e:
        click.echo(f"Error: Failed to load configuration: {e}", err=True)
        raise click.Abort()

    # Extract frontend-relevant configuration
    frontend_config = {
        "appName": config.app.name,
        "backendUrl": f"{config.api.scheme}://{config.api.host}:{config.api.port}/api",
        "frontendUrl": f"{config.app.scheme}://{config.app.host}:{config.app.port}",
    }

    # Create frontend config directory if it doesn't exist
    frontend_config_dir = Path.cwd() / "frontend" / "src" / "config"
    frontend_config_dir.mkdir(parents=True, exist_ok=True)

    # Write the config as a JavaScript module
    config_file = frontend_config_dir / "config.js"
    with open(config_file, "w") as f:
        f.write("// Auto-generated from config/config.yaml - DO NOT EDIT MANUALLY\n")
        f.write("// Run 'cygnus generate-frontend-config' to regenerate\n\n")
        f.write("const config = ")
        f.write(json.dumps(frontend_config, indent=2))
        f.write(";\n\nexport default config;\n")

    click.echo(f"Frontend config generated at {config_file}")


if __name__ == "__main__":
    cli()
