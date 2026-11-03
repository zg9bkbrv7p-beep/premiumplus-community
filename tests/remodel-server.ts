// Explicit synthetic integration fixture; never imported by production server/index.ts.
import { createApp } from "../server/app";
import { createServer } from "vite";
import sharp from "sharp";
if (process.env.NODE_ENV !== "test")
  throw Error("Synthetic provider may only run in test mode");
const { http } = createApp(
  process.env.DATABASE_PATH!,
  "http://localhost:3101",
  {
    remodelProvider: {
      name: "test-only",
      model: "synthetic-test",
      edit: async () => ({
        image: await sharp({
          create: {
            width: 1024,
            height: 1024,
            channels: 3,
            background: "#934b25",
          },
        })
          .png()
          .toBuffer(),
        usage: { synthetic: true },
      }),
    },
  },
);
const vite = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: "spa",
});
http.use(vite.middlewares);
http.listen(3101, "127.0.0.1");
