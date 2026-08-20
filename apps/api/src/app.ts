import express from "express";
import cors from "cors";
import helmet from "helmet";
import { checkDatabase } from "./config/database.js";
import { checkRabbitMq } from "./config/rabbitmq.js";
import { checkRedis } from "./config/redis.js";
import { optionalAuth } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error-handler.js";
import { structuredLogger } from "./middleware/logger.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import v1Routes from "./routes/index.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware);
app.use(structuredLogger);
app.use(optionalAuth);

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "nexora-api",
  });
});

app.get("/ready", async (_req, res) => {
  const [database, redis, rabbitmq] = await Promise.all([checkDatabase(), checkRedis(), checkRabbitMq()]);
  const ready = database && redis && rabbitmq;

  res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "not_ready",
    services: {
      database: database ? "up" : "down",
      redis: redis ? "up" : "down",
      rabbitmq: rabbitmq ? "up" : "down",
    },
  });
});

app.use("/api/v1", v1Routes);
app.use(errorHandler);

export default app;
