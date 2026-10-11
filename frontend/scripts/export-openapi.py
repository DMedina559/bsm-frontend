"""Export the configured backend HTTP contract without starting its runtime."""
import json
import sys
import tempfile
from types import SimpleNamespace

from bedrock_server_manager.web.app import create_web_app

# App construction only needs themes, CORS defaults, and a plugin binding hook.
# Do not load plugins or enter lifespan: this export represents the core API.
with tempfile.TemporaryDirectory() as directory:
    context = SimpleNamespace(
        settings={"paths.themes": directory},
        get_pre_app_config=lambda _key, default: default,
        plugin_manager=SimpleNamespace(bind_web_app=lambda _app: None),
    )
    app = create_web_app(context)
    # Installed package versions vary with checkout depth; they do not change models.
    app.version = "contract"
    with open(sys.argv[1], "w", encoding="utf-8") as output:
        json.dump(app.openapi(), output, indent=2, sort_keys=True)
        output.write("\n")
