"""Compare a freshly exported backend schema with the frontend contract."""
import json
import pathlib
import sys
expected = json.loads((pathlib.Path(__file__).parent.parent / "src/api/generated/openapi.json").read_text())
actual = json.loads(pathlib.Path(sys.argv[1]).read_text())
if expected != actual:
    expected_ops = {value["operationId"] for path in expected["paths"].values() for value in path.values() if isinstance(value, dict) and "operationId" in value}
    actual_ops = {value["operationId"] for path in actual["paths"].values() for value in path.values() if isinstance(value, dict) and "operationId" in value}
    print("Backend contract drift. Regenerate and review the frontend schema and client.")
    print("Added operations:", sorted(actual_ops - expected_ops))
    print("Removed operations:", sorted(expected_ops - actual_ops))
    sys.exit(1)
print("Backend HTTP contract matches the frontend schema.")
