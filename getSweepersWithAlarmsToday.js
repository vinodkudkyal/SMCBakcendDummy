// /**
//  * getSweepersWithAlarmsToday.js
//  * Run: node getSweepersWithAlarmsToday.js
//  */

// const mongoose = require("mongoose");

// // ======================
// // 🔹 MONGO CONNECTION
// // ======================
// const MONGO_URI =
//   "mongodb+srv://nagarshuddhismc_db_user:KU0RkVNSLcm23rkc@cluster0.7h8qa0n.mongodb.net/nagarshuddhi?retryWrites=true&w=majority&appName=Cluster0";

// mongoose
//   .connect(MONGO_URI) // ✅ FIX: no deprecated options
//   .then(() => console.log("✅ MongoDB connected"))
//   .catch((err) => {
//     console.error("❌ MongoDB connection failed:", err.message);
//     process.exit(1);
//   });

// // ======================
// // 🔹 SWEEPER SCHEMA
// // ======================
// const sweeperSchema = new mongoose.Schema(
//   {
//     name: String,
//     email: String,
//     alarmEvents: Object
//   },
//   { collection: "sweepers" }
// );

// const Sweeper = mongoose.model("Sweeper", sweeperSchema);

// // ======================
// // 🔹 MAIN LOGIC
// // ======================
// async function getSweepersWithAlarmsToday() {
//   try {
//     // YYYY-MM-DD (same format used in alarmEvents keys)
//     const todayKey = new Date().toISOString().slice(0, 10);

//     console.log("📅 Checking alarms for date:", todayKey);

//     // Query sweepers who have at least ONE alarm today
//     const sweepers = await Sweeper.find(
//       {
//         [`alarmEvents.${todayKey}`]: { $exists: true, $ne: [] }
//       },
//       {
//         name: 1,
//         email: 1,
//         _id: 0
//       }
//     ).lean();

//     const totalCount = sweepers.length;

//     console.log("\n✅ Sweepers with at least one alarm today:");
//     console.table(sweepers);

//     console.log("\n📊 TOTAL COUNT:", totalCount);

//     return {
//       date: todayKey,
//       totalCount,
//       sweepers
//     };
//   } catch (err) {
//     console.error("❌ Error fetching sweepers:", err.message);
//   } finally {
//     await mongoose.disconnect();
//     console.log("\n🔌 MongoDB disconnected");
//   }
// }

// // ======================
// // 🔹 RUN SCRIPT
// // ======================
// getSweepersWithAlarmsToday();



/**
 * getSweepersWithAnyAlarm.js
 * Run: node getSweepersWithAnyAlarm.js
 */

const mongoose = require("mongoose");

// ======================
// 🔹 MONGO CONNECTION
// ======================
const MONGO_URI =
//   "mongodb+srv://nagarshuddhismc_db_user:KU0RkVNSLcm23rkc@cluster0.7h8qa0n.mongodb.net/nagarshuddhi?retryWrites=true&w=majority&appName=Cluster0";
  "mongodb+srv://vinodkudkyal05_db_user:S5uyYxwVgdiIS9av@cluster0.pyl5tmk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });

// ======================
// 🔹 SWEEPER SCHEMA
// ======================
const sweeperSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    alarmEvents: Object
  },
  { collection: "sweepers" }
);

const Sweeper = mongoose.model("Sweeper", sweeperSchema);

// ======================
// 🔹 MAIN LOGIC
// ======================
async function getSweepersWithAnyAlarm() {
  try {
    console.log("🔍 Finding sweepers with at least ONE alarm (any date)");

    const sweepers = await Sweeper.find(
      {
        alarmEvents: { $exists: true, $ne: {} }
      },
      {
        name: 1,
        email: 1,
        alarmEvents: 1
      }
    ).lean();

    const result = [];

    for (const s of sweepers) {
      let hasAlarm = false;

      for (const dateKey in s.alarmEvents) {
        if (
          Array.isArray(s.alarmEvents[dateKey]) &&
          s.alarmEvents[dateKey].length > 0
        ) {
          hasAlarm = true;
          break;
        }
      }

      if (hasAlarm) {
        result.push({
          name: s.name,
          email: s.email
        });
      }
    }

    console.log("\n✅ Sweepers with alarms (matches frontend):");
    console.table(result);

    console.log("\n📊 TOTAL COUNT:", result.length);

    return result;
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 MongoDB disconnected");
  }
}

// ======================
// 🔹 RUN SCRIPT
// ======================
getSweepersWithAnyAlarm();
