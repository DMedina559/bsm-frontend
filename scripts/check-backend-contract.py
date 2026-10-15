"""Compare an exported backend contract with the frontend's bundled schema."""

import json
import sys
from pathlib import Path

from bedrock_server_manager.web.contract import contract_changes

expected = json.loads(
    (Path(__file__).parent.parent / "packages/api-client/src/generated/openapi.json").read_text(
        encoding="utf-8"
    )
)
actual = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
if expected != actual:
    for label, changes in contract_changes(expected, actual).items():
        print(f"{label}: {changes}")
    sys.exit(
        "Backend contract drift. Regenerate and review the frontend schema and client."
    )
print("Backend HTTP contract matches the frontend schema.")
