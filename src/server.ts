import fs from "node:fs";
import fsProm from "node:fs/promises";
import path from "node:path";
import { pipeline as pipelineProm } from "node:stream/promises";

import fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";

import { rootDir } from "./utils/fs.ts";

const tmpDir = "tmp";
const host = process.env.HOST ?? "0.0.0.0";
const port = process.env.PORT ? parseInt(process.env.PORT) : 443;

const server = fastify({
  logger: true,
  http2: true,
  https: {
    key: fs.readFileSync(path.join(rootDir(), "certstore", "key.pem")),
    cert: fs.readFileSync(path.join(rootDir(), "certstore", "cert.pem")),
  },
});

await server.register(cors);
await server.register(multipart);

server.post("/videos", async function (request: any, reply: any) {
  const data = await request.file();
  pipelineProm(data.file, fs.createWriteStream(data.filename, { flags: "a" }));
  reply.code(200).send({});
});

server.listen({ host, port });

server.addHook("onReady", async () => {
  await createTempDirectory();
});

server.addHook("onClose", async () => {
  await gracefulShutdown();
});

process.on("SIGINT", () => {
  gracefulShutdown();
});

process.on("SIGTERM", () => {
  gracefulShutdown();
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

async function gracefulShutdown() {
  try {
    await fsProm.rmdir(path.join(rootDir(), tmpDir), { recursive: true });
    console.log("Directory removed:", tmpDir);
  } catch (err) {
    console.error("Error removing directory:", tmpDir, (err as Error).message);
  } finally {
    process.exit(0);
  }
}

async function createTempDirectory() {
  try {
    await fsProm.mkdir(path.join(rootDir(), tmpDir));
    console.info("Directory created:", tmpDir);
  } catch (err) {
    console.error("Error creating directory:", tmpDir, (err as Error).message);
  }
}
