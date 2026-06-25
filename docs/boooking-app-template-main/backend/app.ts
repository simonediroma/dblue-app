import dotenv from "dotenv";
import path from "path";

if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: path.resolve(__dirname, "../.env.production") });
} else if (process.env.NODE_ENV === "development") {
  dotenv.config({ path: path.resolve(__dirname, "../.env.development") });
} else {
  dotenv.config({ path: path.resolve(__dirname, "../.env.staging") });
}

import express, { Request, Response } from "express";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import compression from "compression";
import connectToDatabase from "./config/coreDb";
import http from "http";

import { initializeSocket } from "./config/socketHandler";
import { startChangeStreams } from "./services/changeStream.service";

// routes
import auth from "./routes/auth";
import office from "./routes/office";

const app = express();
const port = Number(process.env.PORT) || 3001;

const server = http.createServer(app);
const io = initializeSocket(server);

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));

app.options("/{*any}", cors({ origin: process.env.FRONTEND_URL, credentials: true }));

app.use(compression({ filter: shouldCompress }));

function shouldCompress(req: Request, res: Response) {
  if (req.headers["x-no-compression"]) return false;
  return compression.filter(req, res);
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("tiny"));
app.use("/public", express.static(path.join(__dirname, "public")));

// routes
app.use("/api/v1/auth", auth);
app.use("/api/v1/office", office);

// Serve Frontend in production
const frontendDistPath = path.join(__dirname, "../frontend/dist");
if (process.env.NODE_ENV === "production") {
  app.use(express.static(frontendDistPath));
  app.get("/{*any}", (req, res) => {
    res.sendFile(path.join(frontendDistPath, "index.html"));
  });
} else if (process.env.NODE_ENV === "development") {
  app.get("/", (req, res) => res.send("Please set to production"));
} else {
  // staging
  app.use(express.static(frontendDistPath));
  app.get("/{*any}", (req, res) => {
    res.sendFile(path.join(frontendDistPath, "index.html"));
  });
}

connectToDatabase(process.env.DB_URL as string)
  .then(() => {
    server.listen(port, () => {
      console.log("NODE_ENV:", process.env.NODE_ENV);
      console.log(`Server is running on port: ${port}`);
    });
    startChangeStreams(io);
  })
  .catch((error) => {
    console.error("Failed to connect to the database:", error);
    process.exit(1);
  });
