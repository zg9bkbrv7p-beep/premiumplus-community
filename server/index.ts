import {scheduleBackups} from './backup';
import { createApp } from "./app";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
const port = Number(process.env.PORT || 3000),
  publicUrl = process.env.PUBLIC_URL || `http://localhost:${port}`;
const { http, db } = createApp(
  process.env.DATABASE_PATH || resolve("data/community.sqlite"),
  publicUrl,
);
if (process.env.NODE_ENV === "production" && existsSync("dist/index.html")) {
  const express = await import("express");
  http.use(express.default.static(resolve("dist")));
  http.get("/{*path}", (_req, res) => res.sendFile(resolve("dist/index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true, allowedHosts: true },
    appType: "spa",
  });
  http.use(vite.middlewares);
}
if(process.env.BACKUP_DIRECTORY){
 scheduleBackups(db,process.env.DATABASE_PATH||resolve('data/community.sqlite'),process.env.BACKUP_DIRECTORY,Number(process.env.BACKUP_INTERVAL_MS||86400000),()=>console.error(JSON.stringify({event:'backup_failed',at:new Date().toISOString()})));
}
http.listen(port, "0.0.0.0", () =>
  console.log(`PREMIUM+ Community is ready at ${publicUrl}`),
);
