import fs from "node:fs";
import fsProm from "node:fs/promises";
import path from "node:path";
import { pipeline as pipelineProm } from "node:stream/promises";

import fastify from "fastify";
import cors from "@fastify/cors";
import fastifyEnv from "@fastify/env";
import multipart from "@fastify/multipart";
import mongodb from "@fastify/mongodb";
import sgMail from "@sendgrid/mail";

import { generateOTP } from "./utilities/index.ts";

const uploadDir = "tmp";

const server = await fastify({
  logger: true,
  http2: true,
  https: {
    allowHTTP1: process.env.NODE_ENV === "development",
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
    required: ["NODE_ENV", "HOST", "PORT", "SENDGRID_API_KEY", "MONGODB_URI"],
    properties: {
      NODE_ENV: {
        type: "string",
        default: process.env.NODE_ENV,
      },
      HOST: {
        type: "string",
        default: "0.0.0.0",
      },
      PORT: {
        type: "number",
        default: 443,
      },
      MONGODB_URI: {
        type: "string",
        default: "mongodb://localhost:27017/app",
      },
      SENDGRID_API_KEY: {
        type: "string",
      },
    },
  },
});
await server.register(cors);
await server.register(multipart);
await server.register(mongodb, {
  forceClose: true,
  url: server.config.MONGODB_URI,
});
await server.after();

server.post("/login", async function (request: any, reply: any) {
  const { email } = request.body;
  const User = this.mongo.client.db("app").collection("users");
  const otp = generateOTP();

  try {
    const user = await User.findOneAndUpdate(
      { email },
      { $set: { login: { otp, at: new Date() } }, $setOnInsert: { email } },
      { upsert: true }
    );
    sgMail.send({
      to: email,
      from: "hrxd@seomastergroup.com",
      subject: `Login OTP ${otp}`,
      text: "Please login with the OTP",
    });
    reply.code(202).send();
  } catch (error: any) {
    console.error(error);
  }
});

server.post("/verify", async function (request: any, reply: any) {
  const { email, otp } = request.body;
  const User = this.mongo.client.db("app").collection("users");

  try {
    const user = await User.findOne({ email });
    if (user?.login?.otp === otp) {
      reply.code(202).send();
    } else {
      reply.code(401).send();
    }
  } catch (error: any) {
    console.error(error);
  }
});

server.post("/logout", async function (request: any, reply: any) {});

server.post("/videos", async function (request: any, reply: any) {
  const data = await request.file();
  pipelineProm(data.file, fs.createWriteStream(data.filename));
  reply.code(202).end();
});

server.addHook("onReady", async () => {
  sgMail.setApiKey(server.config.SENDGRID_API_KEY);
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
      NODE_ENV: string;
      HOST: string;
      PORT: number;
      SENDGRID_API_KEY: string;
      MONGODB_URI: string;
    };
  }
}
