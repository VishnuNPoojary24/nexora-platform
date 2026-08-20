import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_HOST: z.string().default("localhost"),
  DATABASE_PORT: z.coerce.number().int().positive().default(5432),
  DATABASE_NAME: z.string().default("nexora"),
  DATABASE_USER: z.string().default("nexora"),
  DATABASE_PASSWORD: z.string().default("nexora_dev_password"),
  DATABASE_POOL_MIN: z.coerce.number().int().min(0).default(0),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  DATABASE_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  DATABASE_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  AUTH_JWT_SECRET: z.string().min(32).default("nexora_dev_auth_secret_nexora_dev_auth_secret"),
  AUTH_JWT_TTL_SECONDS: z.coerce.number().int().positive().default(86400),
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  RABBITMQ_HOST: z.string().default("localhost"),
  RABBITMQ_PORT: z.coerce.number().int().positive().default(5672),
  RABBITMQ_USER: z.string().default("nexora"),
  RABBITMQ_PASSWORD: z.string().default("nexora_dev_password"),
  MINIO_ENDPOINT: z.string().url().default("http://localhost:9000"),
  MINIO_ACCESS_KEY: z.string().default("nexora"),
  MINIO_SECRET_KEY: z.string().default("nexora_dev_password"),
  MINIO_BUCKET: z.string().default("nexora-attachments"),
  KEYCLOAK_ISSUER: z.string().url().default("http://localhost:8080/realms/nexora"),
  KEYCLOAK_CLIENT_ID: z.string().default("nexora-web"),
  KEYCLOAK_CLIENT_SECRET: z.string().optional().default(""),
  AI_SERVICE_URL: z.string().url().default("http://localhost:8000"),
});

export const env = envSchema.parse(process.env);
