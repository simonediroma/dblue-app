import { Server } from "socket.io";
import { Model, Document } from "mongoose";
import mongoose from "mongoose";

type WatchedStream = mongoose.mongo.ChangeStream;

// Generic helper — one call per model that needs real-time sync.
//
// eventPrefix  → socket event names: `${eventPrefix}_update`, `${eventPrefix}_delete`
// getChannel   → optional: derive a channel ID from the document to target a subset of clients.
//                Return a string to emit only to that channel; omit to broadcast to all clients.
//
// On error the stream closes and restarts after 5 seconds (handles MongoDB primary failover).
const watchCollection = <T extends Document>(
  model: Model<T>,
  io: Server,
  eventPrefix: string,
  getChannel?: (doc: T) => string | null | undefined
): WatchedStream => {
  const stream = model.watch([], { fullDocument: "updateLookup" });

  stream.on("change", (change: any) => {
    if (change.operationType === "insert" || change.operationType === "update") {
      const doc = change.fullDocument as T;
      if (!doc) return;
      const channel = getChannel?.(doc);
      const target = channel ? io.to(channel) : io;
      target.emit(`${eventPrefix}_update`, doc);
    } else if (change.operationType === "delete") {
      const id = change.documentKey?._id;
      if (!id) return;
      io.emit(`${eventPrefix}_delete`, { _id: id });
    }
  });

  stream.on("error", (error: unknown) => {
    console.error(`[changeStream] Error on ${model.modelName}:`, error);
    stream.close();
    setTimeout(() => watchCollection(model, io, eventPrefix, getChannel), 5000);
  });

  return stream;
};

// Called once after both the DB connection and socket.io are initialized.
// Register one watchCollection() per model that needs real-time updates.
// Cleanup (stream close) is registered automatically on process exit.
export const startChangeStreams = (io: Server): void => {
  const streams: WatchedStream[] = [];

  // ── Register models to watch ─────────────────────────────────────────────
  //
  // Import your model, then call watchCollection once per model.
  // import MyModel from "../models/myModel";
  //
  // Option A — broadcast the change to ALL connected clients:
  // streams.push(watchCollection(MyModel, io, "mymodel"));
  //
  // Option B — emit only to a specific channel (a subset of clients).
  // Derive the channel ID from a field on the document — use whichever field
  // makes sense for your application (e.g. an owner ID, a booking date, a room ID):
  // streams.push(
  //   watchCollection(MyModel, io, "mymodel", (doc) => (doc as any).roomId?.toString())
  // );
  //
  // The frontend receives:
  //   socket.on("mymodel_update", (doc) => { ... })     // insert or update
  //   socket.on("mymodel_delete", ({ _id }) => { ... }) // delete
  // ─────────────────────────────────────────────────────────────────────────

  const cleanup = () => streams.forEach((s) => s.close());
  process.once("SIGTERM", cleanup);
  process.once("SIGINT", cleanup);
};
