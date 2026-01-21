const mongoose = require("mongoose");

// ================= DB =================
const MONGO_URI =
  "mongodb+srv://vinodkudkyal05_db_user:S5uyYxwVgdiIS9av@cluster0.pyl5tmk.mongodb.net/nagarshuddhi";

mongoose.connect(MONGO_URI);

// ================= MODELS =================
const Sweeper = mongoose.model("Sweeper", new mongoose.Schema({}, { strict: false }));
const EventIndex = mongoose.model(
  "EventIndex",
  new mongoose.Schema({}, { strict: false }),
  "eventindexes"
);
const Attendance = mongoose.model(
  "Attendance",
  new mongoose.Schema({}, { strict: false })
);
const AlarmEvent = mongoose.model(
  "AlarmEvent",
  new mongoose.Schema({}, { strict: false }),
  "alarmevents"
);

// ================= TARGET SWEEPERS =================
const TARGETS = [
  { name: "Suraj Gavali", email: "Surajgavali@smc.com" },
  { name: "Sandeep Gade", email: "Sandeepgade@smc.com" },
  { name: "Dhanaji Nagnath Londe", email: "dhanajilonde@012" },
  { name: "Kavita Kiran Solanki", email: "Kavitasolanki@016" },
  { name: "sanjay gondiba kamble", email: "sanjaykamble17" },
  { name: "avinashsubhashsarwade", email: "avinashsarwade20@smc.com" },
  { name: "arunsomnathgavate", email: "arun20@smc.com" },
  { name: "Amar Sonakambale", email: "amarsonakambale28" },
  { name: "kiranmaidangirkar", email: "kiranmaidangirkar26@gmail.com" },
  { name: "Dhiraj Huwale", email: "dhirajhuwale44" },
  { name: "vijay kongari", email: "vijaykongari44" }
];

// ================= CORE =================
async function run() {
  console.log("🧹 Resetting alarms & attendance for selected sweepers...");

  for (const t of TARGETS) {
    const sweeper = await Sweeper.findOne({ email: t.email });

    if (!sweeper) {
      console.log(`⚠️ Sweeper not found: ${t.name}`);
      continue;
    }

    const sid = sweeper._id;

    // 1️⃣ Clear embedded alarms
    await Sweeper.updateOne(
      { _id: sid },
      {
        $set: {
          alarmEvents: {},   // 🔥 wipe all alarms
          partitions: {}     // optional but safe
        }
      }
    );

    // 2️⃣ Remove event indexes
    await EventIndex.deleteMany({ sweeperId: sid });

    // 3️⃣ Remove attendance
    await Attendance.deleteMany({ sweeperId: sid });

    // 4️⃣ Remove legacy alarms (important for popup)
    await AlarmEvent.deleteMany({ sweeperId: sid.toString() });

    console.log(`✅ Cleared alarms & attendance: ${t.name}`);
  }

  console.log("🎯 RESET COMPLETED");
  process.exit(0);
}

run().catch(err => {
  console.error("❌ FAILED:", err);
  process.exit(1);
});
