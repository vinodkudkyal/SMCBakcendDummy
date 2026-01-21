// const mongoose = require("mongoose");

// // ================= DB =================
// const MONGO_URI =
//   "mongodb+srv://vinodkudkyal05_db_user:S5uyYxwVgdiIS9av@cluster0.pyl5tmk.mongodb.net/nagarshuddhi";

// mongoose.connect(MONGO_URI);

// // ================= MODELS =================
// const Sweeper = mongoose.model("Sweeper", new mongoose.Schema({}, { strict: false }));
// const EventIndex = mongoose.model(
//   "EventIndex",
//   new mongoose.Schema({}, { strict: false }),
//   "eventindexes"
// );
// const Attendance = mongoose.model(
//   "Attendance",
//   new mongoose.Schema({}, { strict: false })
// );

// // ================= EXCLUDE LIST =================
// const EXCLUDED_EMAILS = [
//   "surajgavali@smc.com",
//   "sandeepgade@smc.com",
//   "dhanajilonde@012",
//   "kavitasolanki@016",
//   "avinashsarwade20@smc.com",
//   "arun20@smc.com",
//   "amarsonakambale28",
//   "kiranmaidangirkar26@gmail.com",
//   "dhirajhuwale44",
//   "vijaykongari44"
// ].map(e => e.toLowerCase());

// // ================= DATE HELPERS =================
// function getISTDate(d = new Date()) {
//   return new Date(d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
// }

// function dateKeyFromDate(d) {
//   return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
//     d.getDate()
//   ).padStart(2, "0")}`;
// }

// function istDayStart(key) {
//   return new Date(`${key}T00:00:00+05:30`);
// }

// // ================= TIME =================
// function parseDutyToMinutes(t) {
//   if (!t) return null;
//   t = t.toUpperCase().trim();
//   const m = t.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/);
//   if (!m) return null;

//   let h = Number(m[1]);
//   let min = Number(m[2] || 0);
//   if (m[3] === "PM" && h !== 12) h += 12;
//   if (m[3] === "AM" && h === 12) h = 0;
//   return h * 60 + min;
// }

// function minutesToDate(min, base) {
//   const d = new Date(base);
//   d.setMinutes(min);
//   return d;
// }

// // ================= CORE =================
// async function run() {
//   const sweepers = await Sweeper.find({
//     email: { $nin: EXCLUDED_EMAILS }
//   });

//   console.log(`👥 Sweepers to process: ${sweepers.length}`);

//   let current = getISTDate(new Date("2026-01-21T00:00:00+05:30"));
//   const today = getISTDate();

//   for (const sweeper of sweepers) {
//     const startMin = parseDutyToMinutes(sweeper.dutyTime?.start);
//     const endMin = parseDutyToMinutes(sweeper.dutyTime?.end);

//     if (!startMin || !endMin || endMin <= startMin) {
//       console.log(`⚠️ Skipped (invalid duty time): ${sweeper.email}`);
//       continue;
//     }

//     const gap = Math.floor((endMin - startMin) / 3);

//     console.log(`🧹 Processing sweeper: ${sweeper.email}`);

//     let day = new Date(current);

//     while (day <= today) {
//       const DATE_KEY = dateKeyFromDate(day);
//       const dayStart = istDayStart(DATE_KEY);
//       const dayEnd = new Date(dayStart.getTime() + 86400000);

//       // 🔥 Clean old data
//       await EventIndex.deleteMany({ sweeperId: sweeper._id, dateKey: DATE_KEY });
//       await Attendance.deleteMany({
//         sweeperId: sweeper._id,
//         date: { $gte: dayStart, $lt: dayEnd }
//       });

//       // 🔑 attended = 2 or 3
//       const attendedCount = Math.random() < 0.5 ? 2 : 3;
//       const attendedSet = new Set();
//       while (attendedSet.size < attendedCount) {
//         attendedSet.add(Math.floor(Math.random() * 3));
//       }

//       const events = [];
//       let lastAlarmTime = null;

//       for (let i = 0; i < 3; i++) {
//         const t = minutesToDate(
//           startMin + gap * i + Math.floor(gap / 2),
//           dayStart
//         );
//         lastAlarmTime = t;

//         const attended = attendedSet.has(i);
//         const id = new mongoose.Types.ObjectId().toString();

//         events.push({
//           id,
//           alarmTimestampMs: t.getTime(),
//           createdAt: t,
//           opened: attended,
//           verificationStatus: attended ? "attended" : "missed",
//           verificationTimestampMs: attended ? t.getTime() : null,
//           withinGeofence: attended ? true : null,
//           location: null
//         });

//         await EventIndex.create({
//           eventId: id,
//           sweeperId: sweeper._id,
//           dateKey: DATE_KEY,
//           storage: "sweeper",
//           createdAt: t
//         });
//       }

//       // 🔁 UPDATE alarms (not append)
//       await Sweeper.updateOne(
//         { _id: sweeper._id },
//         { $set: { [`alarmEvents.${DATE_KEY}`]: events } }
//       );

//       // ✅ Attendance AFTER 3rd alarm
//       if (attendedCount >= 2 && lastAlarmTime >= dayStart && lastAlarmTime <= dayEnd) {
//         await Attendance.create({
//           sweeperId: sweeper._id,
//           date: lastAlarmTime,
//           location: null,
//           createdAt: lastAlarmTime
//         });
//       }

//       day.setDate(day.getDate() + 1);
//     }
//   }

//   console.log("✅ DONE: All non-excluded sweepers processed");
//   process.exit(0);
// }

// run().catch(err => {
//   console.error("❌ FAILED:", err);
//   process.exit(1);
// });



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

// ================= TARGET =================
const TARGET_EMAIL = "rameshg@smc20";
const DATE_KEY = "2026-01-19";

// ================= HELPERS =================
function istDayStart(key) {
  return new Date(`${key}T00:00:00+05:30`);
}

function parseDutyToMinutes(t) {
  if (!t) return null;
  t = t.trim().toUpperCase();
  const m = t.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/);
  if (!m) return null;

  let h = Number(m[1]);
  let min = Number(m[2] || 0);
  if (m[3] === "PM" && h !== 12) h += 12;
  if (m[3] === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

function minutesToDate(min, base) {
  const d = new Date(base);
  d.setMinutes(min);
  return d;
}

// ================= CORE =================
async function run() {
  const sweeper = await Sweeper.findOne({ email: TARGET_EMAIL });
  if (!sweeper) {
    console.log("❌ Sweeper not found");
    process.exit(1);
  }

  const startMin = parseDutyToMinutes(sweeper.dutyTime?.start);
  const endMin = parseDutyToMinutes(sweeper.dutyTime?.end);

  if (!startMin || !endMin || endMin <= startMin) {
    console.log("❌ Invalid duty time");
    process.exit(1);
  }

  const dayStart = istDayStart(DATE_KEY);
  const dayEnd = new Date(dayStart.getTime() + 86400000);
  const gap = Math.floor((endMin - startMin) / 3);

  console.log(`🛠 Updating ${sweeper.name} for ${DATE_KEY}`);

  // 🔥 CLEAN EXISTING DATA FOR THAT DAY
  await EventIndex.deleteMany({
    sweeperId: sweeper._id,
    dateKey: DATE_KEY
  });

  await Attendance.deleteMany({
    sweeperId: sweeper._id,
    date: { $gte: dayStart, $lt: dayEnd }
  });

  const events = [];
  let lastAlarmTime = null;

  // 🔑 First 2 attended, last missed (exactly 2 attended)
  const attendedSet = new Set([0, 1]);

  for (let i = 0; i < 3; i++) {
    const t = minutesToDate(
      startMin + gap * i + Math.floor(gap / 2),
      dayStart
    );
    lastAlarmTime = t;

    const attended = attendedSet.has(i);
    const id = new mongoose.Types.ObjectId().toString();

    events.push({
      id,
      alarmTimestampMs: t.getTime(),
      createdAt: t,
      opened: attended,
      verificationStatus: attended ? "attended" : "missed",
      verificationTimestampMs: attended ? t.getTime() : null,
      withinGeofence: attended ? true : null,
      location: null
    });

    await EventIndex.create({
      eventId: id,
      sweeperId: sweeper._id,
      dateKey: DATE_KEY,
      storage: "sweeper",
      createdAt: t
    });
  }

  // 🔁 UPDATE alarms (replace, not append)
  await Sweeper.updateOne(
    { _id: sweeper._id },
    { $set: { [`alarmEvents.${DATE_KEY}`]: events } }
  );

  // ✅ MARK ATTENDANCE (after 3rd alarm)
  await Attendance.create({
    sweeperId: sweeper._id,
    date: lastAlarmTime,
    location: null,
    createdAt: lastAlarmTime
  });

  console.log("✅ DONE: 2 alarms attended + attendance marked");
  process.exit(0);
}

run().catch(err => {
  console.error("❌ FAILED:", err);
  process.exit(1);
});
