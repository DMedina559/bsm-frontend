"""Export the installed backend's canonical core contract to the supplied path."""

import sys

from bedrock_server_manager.web.contract import main

if __name__ == "__main__":
    sys.argv[1:] = ["--output", *sys.argv[1:]]
    main()
