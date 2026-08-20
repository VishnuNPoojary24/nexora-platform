import amqp, { type Channel, type Connection } from "amqplib";
import { env } from "./env.js";

let connection: Connection | null = null;
let channel: Channel | null = null;

function url(): string {
  return `amqp://${encodeURIComponent(env.RABBITMQ_USER)}:${encodeURIComponent(env.RABBITMQ_PASSWORD)}@${env.RABBITMQ_HOST}:${env.RABBITMQ_PORT}`;
}

export async function getRabbitChannel(): Promise<Channel> {
  if (!connection) {
    connection = await amqp.connect(url());
  }

  if (!channel) {
    channel = await connection.createChannel();
  }

  return channel;
}

export async function publishEvent(routingKey: string, payload: unknown): Promise<void> {
  const exchange = "nexora.events";
  const rabbitChannel = await getRabbitChannel();
  await rabbitChannel.assertExchange(exchange, "topic", { durable: true });
  rabbitChannel.publish(exchange, routingKey, Buffer.from(JSON.stringify(payload)), {
    contentType: "application/json",
    persistent: true,
  });
}

export async function checkRabbitMq(): Promise<boolean> {
  try {
    await getRabbitChannel();
    return true;
  } catch {
    return false;
  }
}
