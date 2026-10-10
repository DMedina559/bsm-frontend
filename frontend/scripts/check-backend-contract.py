"""Compare a freshly exported backend schema with the frontend contract."""
import json
import pathlib
import sys


def operations(schema):
    return {
        value["operationId"]: value
        for path in schema["paths"].values()
        for value in path.values()
        if isinstance(value, dict) and "operationId" in value
    }


expected = json.loads(
    (pathlib.Path(__file__).parent.parent / "src/api/generated/openapi.json").read_text()
)
actual = json.loads(pathlib.Path(sys.argv[1]).read_text())
if expected != actual:
    expected_ops = operations(expected)
    actual_ops = operations(actual)
    expected_models = expected.get("components", {}).get("schemas", {})
    actual_models = actual.get("components", {}).get("schemas", {})
    print("Backend contract drift. Regenerate and review the frontend schema and client.")
    print("Added operations:", sorted(actual_ops.keys() - expected_ops.keys()))
    print("Removed operations:", sorted(expected_ops.keys() - actual_ops.keys()))
    print("Changed operations:", sorted(
        key for key in expected_ops.keys() & actual_ops.keys()
        if expected_ops[key] != actual_ops[key]
    ))
    print("Changed models:", sorted(
        key for key in expected_models.keys() | actual_models.keys()
        if expected_models.get(key) != actual_models.get(key)
    ))
    sys.exit(1)
print("Backend HTTP contract matches the frontend schema.")
