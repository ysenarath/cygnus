"""
Main CLI entry point for Cygnus application.

This module provides command-line interface for various Cygnus operations.
"""

import json
from pathlib import Path

import click
import subprocess

from cygnus.config import load_config

here = Path(__file__).parent


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
    try:
        config = load_config()
    except FileNotFoundError as e:
        click.echo(f"Error: {e}", err=True)
        raise click.Abort()
    except Exception as e:
        click.echo(f"Error: Failed to load configuration: {e}", err=True)
        raise click.Abort()

    # Extract frontend-relevant configuration
    frontend_config = {
        "appName": config.app.name,
        "backendUrl": f"{config.api.scheme}{config.api.host}:{config.api.port}",
        "frontendUrl": f"{config.app.scheme}{config.app.host}:{config.app.port}",
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


@cli.group()
def run():
    """
    Run various Cygnus services.

    Notes
    -----
    Use --help with any command to see detailed usage information.
    """
    pass


@run.command()
def server():
    """
    Run the Cygnus API server.

    Notes
    -----
    Starts the Flask-based API server using configuration from config.yaml.
    """
    # python src/cygnus/app.py in shell
    subprocess.run(["python", "-m", "cygnus.app"], text=True)


@run.command()
def ui():
    """
    Run the Cygnus frontend UI.

    Notes
    -----
    Starts the React-based frontend UI using npm.
    """
    # npm start in frontend directory
    frontend_path = here.parent.parent / "frontend"
    subprocess.run(["npm", "start"], cwd=frontend_path)


setup_ = setup


@run.command()
@click.option(
    "--setup/--no-setup",
    default=False,
    help="Generate frontend config before running services.",
)
def all(setup: bool):
    """
    Run both the Cygnus API server and frontend UI.

    Parameters
    ----------
    setup : bool
        If True, generate the frontend configuration before starting services.

    Notes
    -----
    Starts both the backend API server and the frontend UI concurrently.
    """
    if setup:
        click.echo("Generating frontend configuration...")
        ctx = click.get_current_context()
        ctx.invoke(setup_)
    # Run both server and ui commands
    instance_logs_dir = here.parent.parent / "instance" / "logs"
    instance_logs_dir.mkdir(parents=True, exist_ok=True)
    with (
        open(instance_logs_dir / "backend.log", "a") as log_file,
    ):
        backend = subprocess.Popen(
            ["python", "-m", "cygnus.app"],
            text=True,
            stdout=log_file,
            stderr=log_file,
        )
    frontend_path = here.parent.parent / "frontend"
    with open(instance_logs_dir / "frontend.log", "a") as log_file:
        frontend = subprocess.Popen(
            ["npm", "start"],
            cwd=frontend_path,
            text=True,
            stdout=log_file,
            stderr=log_file,
        )
    # Wait for both to complete
    backend.wait()
    frontend.wait()


if __name__ == "__main__":
    cli()
