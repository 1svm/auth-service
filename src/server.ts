import fs from "node:fs";
import fsAsync from "node:fs/promises";
import path from "node:path";
import fastify from "fastify";

const tmpDir = "tmp";
const host = process.env.HOST ?? "0.0.0.0";
const port = process.env.PORT ? parseInt(process.env.PORT) : 443;

const server = fastify({
  http2: true,
  https: {
    key: fs.readFileSync(path.join(__dirname, "..", "ssl", "key.pem")),
    cert: fs.readFileSync(path.join(__dirname, "..", "ssl", "cert.pem")),
  },
});

server.get("/", function (request: any, reply: any) {
  reply.code(200).send({ hello: "world" });
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
  process.exit(0);
});

async function gracefulShutdown() {
  try {
    await fsAsync.rmdir(tmpDir, { recursive: true });
    console.log("Directory removed:", tmpDir);
  } catch (err) {
    console.error("Error removing directory:", tmpDir, (err as Error).message);
  } finally {
    process.exit(0);
  }
}

async function createTempDirectory() {
  try {
    await fsAsync.mkdir(path.join(__dirname, tmpDir));
    console.info("Directory created:", tmpDir);
  } catch (err) {
    console.error("Error creating directory:", tmpDir, (err as Error).message);
  }
}
