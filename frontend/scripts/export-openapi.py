"""Export the backend's registered HTTP routers without starting its runtime."""
import json
import sys
from fastapi import FastAPI
from bedrock_server_manager.web.routers import all_routers
app = FastAPI()
for router in all_routers:
    app.include_router(router)
with open(sys.argv[1], "w", encoding="utf-8") as output:
    json.dump(app.openapi(), output, indent=2, sort_keys=True)
    output.write("\n")
