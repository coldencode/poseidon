import { MongoClient, Collection, Document } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB ?? "poseidon_db";
const collectionName = process.env.MONGODB_COLLECTION ?? "poses";

if (!uri) {
  throw new Error(
    "Please add MONGODB_URI to .env.local. Get it from https://www.mongodb.com/atlas"
  );
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoClient: MongoClient | undefined;
}

/**
 * Cached MongoDB client for serverless (Vercel).
 * Reuses the connection across hot reloads and requests.
 */
function getClient(): MongoClient {
  if (global._mongoClient) {
    return global._mongoClient;
  }
  global._mongoClient = new MongoClient(uri!);
  return global._mongoClient;
}

export async function getCollection(): Promise<Collection<Document>> {
  const client = getClient();
  await client.connect();
  return client.db(dbName).collection(collectionName);
}
