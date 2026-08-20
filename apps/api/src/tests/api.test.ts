import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import app from "../app.js";
import { pool } from "../config/database.js";

let server: Server;
let baseUrl: string;

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  await pool.end();
});

test("GET /health returns process health", async () => {
  const response = await fetch(`${baseUrl}/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, "ok");
});

test("GET /ready returns dependency shape", async () => {
  const response = await fetch(`${baseUrl}/ready`);
  const body = await response.json();

  assert.ok([200, 503].includes(response.status));
  assert.ok(body.services.database);
  assert.ok(body.services.redis);
  assert.ok(body.services.rabbitmq);
});

test("route validation errors use standard format", async () => {
  const response = await fetch(`${baseUrl}/api/v1/incidents/not-a-uuid`);
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.equal(body.error.code, "VALIDATION_ERROR");
  assert.ok(body.error.requestId);
});
