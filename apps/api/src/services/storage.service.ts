import { env } from "../config/env.js";

export class StorageService {
  readonly bucket = env.MINIO_BUCKET;
  readonly endpoint = env.MINIO_ENDPOINT;

  async upload(): Promise<never> {
    throw new Error("Storage upload is reserved for the attachment sprint.");
  }

  async download(): Promise<never> {
    throw new Error("Storage download is reserved for the attachment sprint.");
  }

  async delete(): Promise<never> {
    throw new Error("Storage delete is reserved for the attachment sprint.");
  }
}
