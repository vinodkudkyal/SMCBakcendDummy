/**
 * remove_extra_seeded_events.js
 * ---------------------------------------
 * Removes LAST 3 seeded alarm events per sweeper
 * Date: 2026-01-19
 */

const mongoose = require("mongoose");

const MONGO_URI =
  "mongodb+srv://vinodkudkyal05_db_user:S5uyYxwVgdiIS9av@cluster0.pyl5tmk.mongodb.net/nagarshuddhi?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGO_URI);

// ======================
// MODELS
// ======================
const Sweeper = mongoose.model(
  "Sweeper",
  new mongoose.Schema({}, { strict: false })
);

const AlarmEvent = mongoose.model(
  "AlarmEvent",
  new mongoose.Schema({}, { strict: false }),
  "alarmevents"
);

// ======================
const DATE_KEY = "2026-01-19";

async function run() {
  console.log("🧹 Removing extra seeded events...");

  const sweepers = await Sweeper.find({
    [`alarmEvents.${DATE_KEY}`]: { $exists: true }
  });

  let sweeperCount = 0;
  let alarmDeletes = 0;

  for (const s of sweepers) {
    const events = s.alarmEvents[DATE_KEY];

    if (!Array.isArray(events) || events.length <= 3) continue;

    // sort by createdAt (newest first)
    const sorted = [...events].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    // take last 3 (newly added)
    const toRemove = sorted.slice(0, 3);
    const toKeep = sorted.slice(3);

    const removeIds = toRemove.map(e => e.id);

    // 1️⃣ remove from sweeper doc
    await Sweeper.updateOne(
      { _id: s._id },
      { $set: { [`alarmEvents.${DATE_KEY}`]: toKeep } }
    );

    // 2️⃣ remove from alarmevents
    const res = await AlarmEvent.deleteMany({
      sweeperId: s._id.toString(),
      alarmTimestampMs: {
        $in: toRemove.map(e => e.alarmTimestampMs)
      }
    });

    alarmDeletes += res.deletedCount;
    sweeperCount++;

    console.log(
      `✅ Sweeper ${s._id} | Removed ${toRemove.length} events`
    );
  }

  console.log("🎯 Cleanup completed");
  console.log(`👥 Sweepers affected: ${sweeperCount}`);
  console.log(`🗑️ alarmevents deleted: ${alarmDeletes}`);

  process.exit(0);
}

run().catch(err => {
  console.error("❌ Cleanup failed:", err);
  process.exit(1);
});
