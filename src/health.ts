import { createServer, type Server } from "node:http";
import type { Metrics } from "./observability.js";

export class HealthServer {
  private readonly server: Server;

  constructor(private readonly port: number, private readonly metrics: Metrics, private readonly snapshot: () => Record<string, unknown>) {
    this.server = createServer((request, response) => {
      const path = request.url ?? "/";
      if (path === "/health") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ status: "ok", ...this.snapshot() }));
        return;
      }
      if (path === "/ready") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ ready: true }));
        return;
      }
      if (path === "/metrics") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify(this.metrics.snapshot()));
        return;
      }
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "not found" }));
    });
  }

  async start(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(this.port, () => resolve());
    });
    this.metrics.set("health.starts", 1);
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
    this.metrics.increment("health.stops");
  }
}