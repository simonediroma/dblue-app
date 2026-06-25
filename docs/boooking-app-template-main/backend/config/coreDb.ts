import mongoose, { ConnectOptions } from "mongoose";

const options: ConnectOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4,
  retryWrites: true,
};

function connectToDatabase(uri: string): Promise<typeof mongoose> {
  mongoose.connection.on("connecting", () => {
    console.log("Connecting to MongoDB...");
  });

  mongoose.connection.on("connected", () => {
    console.log("Successfully connected to MongoDB.");
  });

  mongoose.connection.on("error", (err: Error) => {
    console.error("MongoDB connection error:", err);
    if (err.name === "MongoNetworkError") {
      console.log("Retrying connection in 5 seconds...");
      setTimeout(() => {
        mongoose.connect(uri, options).catch(console.error);
      }, 5000);
    }
  });

  mongoose.connection.on("disconnected", () => {
    console.log("MongoDB disconnected. Attempting to reconnect...");
    mongoose.connect(uri, options).catch(console.error);
  });

  process.on("SIGINT", async () => {
    try {
      await mongoose.connection.close();
      console.log("MongoDB connection closed through app termination");
      process.exit(0);
    } catch (err) {
      console.error("Error during MongoDB disconnect:", err);
      process.exit(1);
    }
  });

  return mongoose.connect(uri, options);
}

export default connectToDatabase;
