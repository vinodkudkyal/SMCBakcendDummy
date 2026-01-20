import { MongoClient } from "mongodb";

// SOURCE (from where data will be copied)
const SOURCE_URI =
  "mongodb+srv://nagarshuddhismc_db_user:KU0RkVNSLcm23rkc@cluster0.7h8qa0n.mongodb.net/nagarshuddhi?retryWrites=true&w=majority&appName=Cluster0";

// DESTINATION (where data will be copied)
const DEST_URI =
  "mongodb+srv://vinodkudkyal05_db_user:S5uyYxwVgdiIS9av@cluster0.pyl5tmk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
//   "mongodb+srv://Nagarshuddhi:nagarshuddhi@cluster0.nttqxhk.mongodb.net/?appName=Cluster0";

const DB_NAME = "nagarshuddhi";

async function migrateDatabase() {
  const sourceClient = new MongoClient(SOURCE_URI);
  const destClient = new MongoClient(DEST_URI);

  try {
    // Connect both clients
    await sourceClient.connect();
    await destClient.connect();

    console.log("Connected to both databases");

    const sourceDb = sourceClient.db(DB_NAME);
    const destDb = destClient.db(DB_NAME);

    // Get all collections
    const collections = await sourceDb.listCollections().toArray();

    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;

      const sourceCollection = sourceDb.collection(collectionName);
      const destCollection = destDb.collection(collectionName);

      const documents = await sourceCollection.find({}).toArray();

      if (documents.length > 0) {
        await destCollection.deleteMany({}); // optional: clear destination
        await destCollection.insertMany(documents);
        console.log(`Copied ${documents.length} docs → ${collectionName}`);
      } else {
        console.log(`Skipped empty collection → ${collectionName}`);
      }
    }

    console.log("Database migration completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await sourceClient.close();
    await destClient.close();
  }
}

migrateDatabase();
