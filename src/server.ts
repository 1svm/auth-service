import fs from "node:fs";
import fsProm from "node:fs/promises";
import path from "node:path";
import { pipeline as pipelineProm } from "node:stream/promises";

import fastify from "fastify";
import cors from "@fastify/cors";
import fastifyEnv from "@fastify/env";
import multipart from "@fastify/multipart";

const uploadDir = "tmp";

const server = await fastify({
  logger: true,
  http2: true,
  https: {
    key: fs.readFileSync(path.join(process.cwd(), "certstore", "key.pem")),
    cert: fs.readFileSync(path.join(process.cwd(), "certstore", "cert.pem")),
  },
});

await server.register(fastifyEnv, {
  dotenv: {
    path: path.join(process.cwd(), ".env"),
    encoding: "utf-8",
    debug: true,
  },
  schema: {
    type: "object",
    required: ["HOST", "PORT", "SENDGRID_API_KEY"],
    properties: {
      HOST: {
        type: "string",
        default: "0.0.0.0",
      },
      PORT: {
        type: "number",
        default: 443,
      },
      SENDGRID_API_KEY: {
        type: "string",
      },
    },
  },
});
await server.register(cors);
await server.register(multipart);
await server.after();

server.post("/login/step-1", async function (request: any, reply: any) {});

server.post("/login/step-2", async function (request: any, reply: any) {});

server.post("/videos", async function (request: any, reply: any) {
  const data = await request.file();
  pipelineProm(data.file, fs.createWriteStream(data.filename));
  reply.code(202).end();
});

server.addHook("onReady", async () => {
  await createTempDirectory();
});

server.addHook("onClose", async () => {
  await gracefulShutdown();
});

await server.ready();
await server.listen({
  host: server.config.HOST,
  port: server.config.PORT,
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
    await fsProm.rmdir(path.join(process.cwd(), uploadDir), {
      recursive: true,
    });
    console.log("Directory removed:", uploadDir);
  } catch (err) {
    console.error(
      "Error removing directory:",
      uploadDir,
      (err as Error).message
    );
  } finally {
    process.exit(0);
  }
}

async function createTempDirectory() {
  try {
    await fsProm.mkdir(path.join(process.cwd(), uploadDir));
    console.info("Directory created:", uploadDir);
  } catch (err) {
    console.error(
      "Error creating directory:",
      uploadDir,
      (err as Error).message
    );
  }
}

declare module "fastify" {
  interface FastifyInstance {
    config: {
      HOST: string;
      PORT: number;
      SENDGRID_API_KEY: string;
    };
  }
}
