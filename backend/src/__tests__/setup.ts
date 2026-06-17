import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer: MongoMemoryServer | undefined;

export async function connect() {
  const externalUri = process.env.MONGODB_URI_TEST;
  if (externalUri) {
    await mongoose.connect(externalUri);
    return;
  }
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
}

export async function disconnect() {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
}

export async function clearDatabase() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}
