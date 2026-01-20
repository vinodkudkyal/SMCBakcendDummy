/**
 * migrate_missed_to_attended.js
 * ---------------------------------------
 * Converts MISSED → ATTENDED
 * Date: 2026-01-19
 * No new records created
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
  console.log("🔄 Migrating MISSED → ATTENDED...");

  // 1️⃣ Update alarmevents
  const alarmRes = await AlarmEvent.updateMany(
    {
      verificationStatus: "missed",
      createdAt: {
        $gte: new Date("2026-01-19T00:00:00Z"),
        $lt: new Date("2026-01-20T00:00:00Z")
      }
    },
    {
      $set: {
        verificationStatus: "attended",
        opened: true,
        "verification.verifiedAt": new Date(),
        "verification.verifiedBy": "system-migration",
        "verification.withinGeofence": true
      }
    }
  );

  console.log(`✅ alarmevents updated: ${alarmRes.modifiedCount}`);

  // 2️⃣ Update sweepers.alarmEvents[DATE_KEY]
  const sweepers = await Sweeper.find({
    [`alarmEvents.${DATE_KEY}`]: { $exists: true }
  });

  let updated = 0;

  for (const s of sweepers) {
    let changed = false;

    const events = s.alarmEvents[DATE_KEY].map(ev => {
      if (ev.verificationStatus === "missed") {
        changed = true;
        return {
          ...ev,
          verificationStatus: "attended",
          opened: true,
          verification: {
            verifiedAt: new Date(),
            verifiedBy: "system-migration",
            withinGeofence: true
          }
        };
      }
      return ev;
    });

    if (changed) {
      await Sweeper.updateOne(
        { _id: s._id },
        { $set: { [`alarmEvents.${DATE_KEY}`]: events } }
      );
      updated++;
    }
  }

  console.log(`✅ sweepers updated: ${updated}`);
  console.log("🎯 Migration completed.");
  process.exit(0);
}

run().catch(err => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
