"""Allow the candidate frontend in a disposable backend integration checkout."""

from pathlib import Path
import re
import sys
import tomllib


def main() -> None:
    pyproject_path = Path(sys.argv[1] if len(sys.argv) > 1 else "backend/pyproject.toml")
    source = pyproject_path.read_text(encoding="utf-8")
    dependencies = tomllib.loads(source)["project"]["dependencies"]
    matches = [
        dependency
        for dependency in dependencies
        if re.match(r"^bsm[-_]frontend\b", dependency, re.IGNORECASE)
    ]
    if len(matches) != 1:
        raise SystemExit("Expected exactly one backend frontend dependency")

    dependency = matches[0]
    old = f'"{dependency}"'
    if source.count(old) != 1:
        raise SystemExit("Expected a single quoted frontend dependency")

    pyproject_path.write_text(source.replace(old, '"bsm-frontend"', 1), encoding="utf-8")
    print(f"Integration-only dependency override: {dependency} -> bsm-frontend")


if __name__ == "__main__":
    main()
