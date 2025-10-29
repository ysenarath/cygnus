#!/usr/bin/env python
"""
Background worker process for document indexing.

This process runs independently from the Flask application
and continuously processes pending documents from the database.
"""

import signal
import sys
import time

from cygnus.indexer import get_indexer


def signal_handler(signum, frame):
    """
    Handle shutdown signals gracefully.

    Parameters
    ----------
    signum : int
        Signal number.
    frame : frame
        Current stack frame.

    Returns
    -------
    None

    Notes
    -----
    Stops the indexer and exits the process cleanly.
    """
    print("Shutting down worker...")
    indexer = get_indexer()
    indexer.stop()
    sys.exit(0)


def main():
    """
    Main entry point for the worker process.

    Returns
    -------
    None

    Notes
    -----
    Sets up signal handlers, initializes the indexer, and runs
    the main processing loop.
    """
    # Set up signal handlers
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

    # Initialize indexer
    print("Initializing document indexer...")
    indexer = get_indexer()
    indexer.start()

    print("Worker process started. Processing documents...")

    # Main loop
    try:
        while True:
            indexer.process_pending_documents()
            time.sleep(10)  # Check every 10 seconds
    except KeyboardInterrupt:
        signal_handler(None, None)


if __name__ == "__main__":
    main()
