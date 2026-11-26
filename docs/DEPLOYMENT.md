# DEPLOYMENT.md

The repository includes a Dockerfile and deploy/compose.yaml. The container runs node dist/cli.js serve, mounts the ignored data directory for the durable ledger and generated identity, and exposes health port 8789.

Before deployment, create .env from .env.example, set the control token and comma-separated voice token pool, and enable the required intents. The container never receives secret values through image layers.

Health endpoints are /health, /ready and /metrics. /health reports status degraded plus degradedFeatures, privilegedIntentsEnabled, gatewayIntents, voiceTokenCount and voiceReflectionComplete; it never hides message-content, presence, member-list or voice-pool degradation. The service handles SIGTERM and SIGINT, stops the health server, unsubscribes both adapters, closes the relay pool and Discord client, and leaves the append-only ledger on disk. Restart replays the ledger, reconciles both inventories and re-establishes subscriptions.

CI runs install, typecheck, unit tests, integration tests, secret scan, secret red check and build. Live inventory and live voice smoke are operator commands because they need real credentials and guild state.