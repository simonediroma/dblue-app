import { Server, Socket } from "socket.io";
import http from "http";

const allowedOrigins: string[] = [];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

if (process.env.NODE_ENV !== "production") {
  allowedOrigins.push("http://localhost:5174");
}

export const initializeSocket = (httpServer: http.Server) => {
  const io = new Server(httpServer, {
    path: "/api/v1/socket.io",
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          console.error(`Socket CORS blocked: ${origin}`);
          callback(new Error("Not allowed by CORS"));
        }
      },
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};
