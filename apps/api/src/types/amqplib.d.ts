declare module "amqplib" {
  export interface Connection {
    createChannel(): Promise<Channel>;
    close(): Promise<void>;
  }

  export interface Channel {
    assertExchange(exchange: string, type: string, options?: { durable?: boolean }): Promise<unknown>;
    publish(exchange: string, routingKey: string, content: Buffer, options?: Record<string, unknown>): boolean;
    close(): Promise<void>;
  }

  export function connect(url: string): Promise<Connection>;

  const amqp: {
    connect: typeof connect;
  };

  export default amqp;
}
