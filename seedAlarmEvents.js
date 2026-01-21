// /**
//  * seedAlarmEvents.core.js
//  * ---------------------------------------
//  * ONE-TIME DATA SEED SCRIPT
//  * - Only sweepers who already have alarms
//  * - Exactly 3 events per sweeper
//  * - Date: 19 Jan 2026
//  * - Updates: sweepers, eventindexes, alarmevents
//  */

// const mongoose = require("mongoose");

// // ======================
// // MONGO CONNECTION
// // ======================
// const MONGO_URI =
//     "mongodb+srv://vinodkudkyal05_db_user:S5uyYxwVgdiIS9av@cluster0.pyl5tmk.mongodb.net/nagarshuddhi?retryWrites=true&w=majority&appName=Cluster0";

// mongoose.connect(MONGO_URI);

// // ======================
// // MODELS (MINIMAL)
// // ======================
// const Sweeper = mongoose.model(
//     "Sweeper",
//     new mongoose.Schema({}, { strict: false })
// );

// const EventIndex = mongoose.model(
//     "EventIndex",
//     new mongoose.Schema({}, { strict: false }),
//     "eventindexes"
// );

// const AlarmEvent = mongoose.model(
//     "AlarmEvent",
//     new mongoose.Schema({}, { strict: false }),
//     "alarmevents"
// );

// // ======================
// // HELPERS
// // ======================
// const SEED_DATE_KEY = "2026-01-19";
// const SEED_DATE_BASE = new Date("2026-01-19T00:00:00Z");

// function timeToMinutes(t) {
//     if (!t || typeof t !== "string") return null;

//     t = t.trim().toUpperCase();

//     // Handle AM/PM format
//     const ampmMatch = t.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/);
//     if (ampmMatch) {
//         let h = Number(ampmMatch[1]);
//         const m = Number(ampmMatch[2]);
//         const ap = ampmMatch[3];

//         if (h < 1 || h > 12 || m < 0 || m > 59) return null;
//         if (ap === "PM" && h !== 12) h += 12;
//         if (ap === "AM" && h === 12) h = 0;

//         return h * 60 + m;
//     }

//     // Handle 24-hour format
//     if (t.includes(":")) {
//         const [h, m] = t.split(":").map(Number);
//         if (
//             Number.isNaN(h) ||
//             Number.isNaN(m) ||
//             h < 0 || h > 23 ||
//             m < 0 || m > 59
//         ) return null;

//         return h * 60 + m;
//     }

//     return null;
// }

// function minutesToMs(m) {
//     return m * 60 * 1000;
// }

// function rand(min, max) {
//     return Math.floor(Math.random() * (max - min + 1)) + min;
// }

// function randomPointInGeofence(geo = []) {
//     if (!geo.length) return null;

//     const lats = geo.map(p => p.latitude);
//     const lngs = geo.map(p => p.longitude);

//     return {
//         latitude: rand(
//             Math.min(...lats) * 1e6,
//             Math.max(...lats) * 1e6
//         ) / 1e6,
//         longitude: rand(
//             Math.min(...lngs) * 1e6,
//             Math.max(...lngs) * 1e6
//         ) / 1e6
//     };
// }

// // ======================
// // CORE LOGIC
// // ======================
// async function runSeed() {
//     console.log("🚀 Seeding alarms for existing-alarm sweepers only...");

//     // 1️⃣ Get sweepers who already have alarms
//     const sweeperIds = await EventIndex.distinct("sweeperId");

//     const sweepers = await Sweeper.find({
//         _id: { $in: sweeperIds }
//     }).lean();

//     console.log(`👥 Sweepers to process: ${sweepers.length}`);

//     for (const s of sweepers) {
//         if (!s.dutyTime?.start || !s.dutyTime?.end) {
//             console.log(`⚠️ Skipped ${s._id} (no duty time)`);
//             continue;
//         }

//         const startMin = timeToMinutes(s.dutyTime.start);
//         const endMin = timeToMinutes(s.dutyTime.end);

//         if (
//             startMin === null ||
//             endMin === null ||
//             endMin <= startMin
//         ) {
//             console.log(
//                 `⚠️ Skipped ${s._id} (invalid duty time: ${s.dutyTime.start} → ${s.dutyTime.end})`
//             );
//             continue;
//         }

//         const total = endMin - startMin;

//         if (total < 10) {
//             console.log(
//                 `⚠️ Skipped ${s._id} (duty duration too short)`
//             );
//             continue;
//         }

//         const part = Math.floor(total / 3);

//         const partitions = [
//             [startMin, startMin + part],
//             [startMin + part, startMin + part * 2],
//             [startMin + part * 2, endMin]
//         ];

//         for (let i = 0; i < 3; i++) {
//             const [pStart, pEnd] = partitions[i];
//             const minute = rand(pStart, pEnd);

//             const eventTime = new Date(
//                 SEED_DATE_BASE.getTime() + minutesToMs(minute)
//             );

//             const location = randomPointInGeofence(s.geofence);
//             const eventId = new mongoose.Types.ObjectId().toString();

//             // 2️⃣ alarmevents (legacy)
//             await AlarmEvent.create({
//                 sweeperId: s._id.toString(),
//                 alarmTimestampMs: eventTime.getTime(),
//                 verificationStatus: "attended",
//                 opened: true,
//                 location,
//                 createdAt: eventTime
//             });

//             // 3️⃣ eventindexes
//             await EventIndex.create({
//                 eventId,
//                 sweeperId: s._id,
//                 dateKey: SEED_DATE_KEY,
//                 storage: "sweeper",
//                 createdAt: eventTime
//             });

//             // 4️⃣ sweepers.alarmEvents
//             await Sweeper.updateOne(
//                 { _id: s._id },
//                 {
//                     $push: {
//                         [`alarmEvents.${SEED_DATE_KEY}`]: {
//                             id: eventId,
//                             alarmTimestampMs: eventTime.getTime(),
//                             verificationStatus: "attended",
//                             opened: true,
//                             location,
//                             createdAt: eventTime
//                         }
//                     }
//                 }
//             );

//             console.log(
//                 `✅ Sweeper ${s._id} | Event ${i + 1} | ${eventTime.toISOString()}`
//             );
//         }
//     }

//     console.log("🎯 Seeding completed.");
//     process.exit(0);
// }

// // ======================
// runSeed().catch(err => {
//     console.error("❌ Seed failed:", err);
//     process.exit(1);
// });








// ?????  jdbsvhyuvd
/////     4 members update



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

// // ================= TARGET SWEEPERS =================
// const TARGET_EMAILS = [
//   "meerasmc@1",
//   "bibimshaikh@smc30.com",
//   "sunil21@smc.com",
//   "bhadangerohan555@gmail.com"
// ];

// // ================= DATE HELPERS =================
// function getTodayISTKey() {
//   const now = new Date();
//   const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
//   return `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, "0")}-${String(
//     ist.getDate()
//   ).padStart(2, "0")}`;
// }

// function istDayStart(dateKey) {
//   return new Date(`${dateKey}T00:00:00+05:30`);
// }

// // ================= TIME PARSER =================
// function parseDutyToMinutes(t) {
//   if (!t || typeof t !== "string") return null;
//   t = t.trim().toUpperCase();

//   let m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
//   if (m) {
//     let h = Number(m[1]), min = Number(m[2]);
//     if (m[3] === "PM" && h !== 12) h += 12;
//     if (m[3] === "AM" && h === 12) h = 0;
//     return h * 60 + min;
//   }

//   m = t.match(/^(\d{1,2})\s*(AM|PM)$/);
//   if (m) {
//     let h = Number(m[1]);
//     if (m[2] === "PM" && h !== 12) h += 12;
//     if (m[2] === "AM" && h === 12) h = 0;
//     return h * 60;
//   }

//   m = t.match(/^(\d{1,2}):(\d{2})$/);
//   if (m) return Number(m[1]) * 60 + Number(m[2]);

//   return null;
// }

// function minutesToISTDate(min, base) {
//   const d = new Date(base);
//   d.setMinutes(min);
//   return d;
// }

// // ================= CORE =================
// async function processDay(sweeper, dateKey) {
//   const startMin = parseDutyToMinutes(sweeper.dutyTime?.start);
//   const endMin = parseDutyToMinutes(sweeper.dutyTime?.end);
//   if (startMin == null || endMin == null || endMin <= startMin) return;

//   const dayStart = istDayStart(dateKey);
//   const gap = Math.floor((endMin - startMin) / 3);

//   let events = [];

//   for (let i = 0; i < 3; i++) {
//     const t = minutesToISTDate(
//       startMin + gap * i + Math.floor(gap / 2),
//       dayStart
//     );
//     const id = new mongoose.Types.ObjectId().toString();

//     const ev = {
//       id,
//       alarmTimestampMs: t.getTime(),
//       createdAt: t,
//       verificationStatus: "attended",
//       verificationTimestampMs: t.getTime(),
//       opened: true,
//       withinGeofence: true,
//       location: null
//     };

//     events.push(ev);

//     await EventIndex.create({
//       eventId: id,
//       sweeperId: sweeper._id,
//       dateKey,
//       storage: "sweeper",
//       createdAt: t
//     });
//   }

//   // Save alarms
//   await Sweeper.updateOne(
//     { _id: sweeper._id },
//     { $set: { [`alarmEvents.${dateKey}`]: events } }
//   );

//   // Attendance — strictly after 3rd alarm
//   const third = events[2];
//   await Attendance.updateOne(
//     {
//       sweeperId: sweeper._id,
//       date: {
//         $gte: dayStart,
//         $lt: new Date(dayStart.getTime() + 86400000)
//       }
//     },
//     {
//       $set: {
//         sweeperId: sweeper._id,
//         date: dayStart,
//         createdAt: new Date(third.verificationTimestampMs),
//         location: third.location || null
//       }
//     },
//     { upsert: true }
//   );
// }

// // ================= RUN =================
// async function run() {
//   const TODAY_KEY = getTodayISTKey();
//   const FIXED_KEY = "2026-01-19";

//   console.log("🚀 Adding alarms + attendance for selected sweepers");

//   for (const email of TARGET_EMAILS) {
//     const sweeper = await Sweeper.findOne({ email });
//     if (!sweeper) {
//       console.log(`⚠️ Sweeper not found: ${email}`);
//       continue;
//     }

//     await processDay(sweeper, FIXED_KEY);
//     await processDay(sweeper, TODAY_KEY);

//     console.log(`✅ Processed sweeper: ${sweeper.name || email}`);
//   }

//   console.log("🎯 DONE");
//   process.exit(0);
// }

// run().catch(err => {
//   console.error("❌ FAILED:", err);
//   process.exit(1);
// });



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

// // ================= TARGET =================
// const TARGET_EMAIL = "rameshg@smc20";

// // ================= DATE HELPERS =================
// function getTodayISTKey() {
//   const now = new Date();
//   const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
//   return `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, "0")}-${String(
//     ist.getDate()
//   ).padStart(2, "0")}`;
// }

// function istDayStart(dateKey) {
//   return new Date(`${dateKey}T00:00:00+05:30`);
// }

// // ================= TIME PARSER =================
// function parseDutyToMinutes(t) {
//   if (!t || typeof t !== "string") return null;
//   t = t.trim().toUpperCase();

//   let m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
//   if (m) {
//     let h = Number(m[1]), min = Number(m[2]);
//     if (m[3] === "PM" && h !== 12) h += 12;
//     if (m[3] === "AM" && h === 12) h = 0;
//     return h * 60 + min;
//   }

//   m = t.match(/^(\d{1,2})\s*(AM|PM)$/);
//   if (m) {
//     let h = Number(m[1]);
//     if (m[2] === "PM" && h !== 12) h += 12;
//     if (m[2] === "AM" && h === 12) h = 0;
//     return h * 60;
//   }

//   m = t.match(/^(\d{1,2}):(\d{2})$/);
//   if (m) return Number(m[1]) * 60 + Number(m[2]);

//   return null;
// }

// function minutesToISTDate(min, base) {
//   const d = new Date(base);
//   d.setMinutes(min);
//   return d;
// }

// // ================= CORE =================
// async function run() {
//   const DATE_KEY = getTodayISTKey();
//   const dayStart = istDayStart(DATE_KEY);
//   const dayEnd = new Date(dayStart.getTime() + 86400000);

//   console.log(`🛠 Setting TODAY alarms (2 missed, 1 attended) for ${TARGET_EMAIL}`);

//   const sweeper = await Sweeper.findOne({ email: TARGET_EMAIL });
//   if (!sweeper) {
//     console.log("❌ Sweeper not found");
//     process.exit(1);
//   }

//   const startMin = parseDutyToMinutes(sweeper.dutyTime?.start);
//   const endMin = parseDutyToMinutes(sweeper.dutyTime?.end);

//   if (startMin == null || endMin == null || endMin <= startMin) {
//     console.log("❌ Invalid duty time");
//     process.exit(1);
//   }

//   const gap = Math.floor((endMin - startMin) / 3);

//   // 🔥 Remove old data for today
//   await EventIndex.deleteMany({ sweeperId: sweeper._id, dateKey: DATE_KEY });
//   await Attendance.deleteMany({
//     sweeperId: sweeper._id,
//     date: { $gte: dayStart, $lt: dayEnd }
//   });

//   const events = [];

//   for (let i = 0; i < 3; i++) {
//     const t = minutesToISTDate(
//       startMin + gap * i + Math.floor(gap / 2),
//       dayStart
//     );

//     const id = new mongoose.Types.ObjectId().toString();
//     const attended = i === 2; // 🔑 only 3rd attended

//     const ev = {
//       id,
//       alarmTimestampMs: t.getTime(),
//       createdAt: t,
//       verificationStatus: attended ? "attended" : "missed",
//       verificationTimestampMs: attended ? t.getTime() : null,
//       opened: attended,
//       withinGeofence: attended ? true : null,
//       location: null
//     };

//     events.push(ev);

//     await EventIndex.create({
//       eventId: id,
//       sweeperId: sweeper._id,
//       dateKey: DATE_KEY,
//       storage: "sweeper",
//       createdAt: t
//     });
//   }

//   // Save alarms
//   await Sweeper.updateOne(
//     { _id: sweeper._id },
//     { $set: { [`alarmEvents.${DATE_KEY}`]: events } }
//   );

//   console.log("✅ Done. 2 missed, 1 attended. Attendance NOT marked.");
//   process.exit(0);
// }

// run().catch(err => {
//   console.error("❌ FAILED:", err);
//   process.exit(1);
// });





// const mongoose = require("mongoose");

// // ================= DB =================
// const MONGO_URI =
//   "mongodb+srv://vinodkudkyal05_db_user:S5uyYxwVgdiIS9av@cluster0.pyl5tmk.mongodb.net/nagarshuddhi";

// mongoose.connect(MONGO_URI);

// // ================= MODELS =================
// const Sweeper = mongoose.model(
//   "Sweeper",
//   new mongoose.Schema({}, { strict: false })
// );

// const EventIndex = mongoose.model(
//   "EventIndex",
//   new mongoose.Schema({}, { strict: false }),
//   "eventindexes"
// );

// const Attendance = mongoose.model(
//   "Attendance",
//   new mongoose.Schema({}, { strict: false })
// );

// // ================= TARGET =================
// const TARGET_EMAIL = "sanjaykamble17";

// // ================= DATE HELPERS =================
// function getISTDate(date = new Date()) {
//   return new Date(
//     date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
//   );
// }

// function dateKeyFromDate(d) {
//   return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
//     d.getDate()
//   ).padStart(2, "0")}`;
// }

// function istDayStart(dateKey) {
//   return new Date(`${dateKey}T00:00:00+05:30`);
// }

// // ================= TIME PARSER =================
// function parseDutyToMinutes(t) {
//   if (!t || typeof t !== "string") return null;
//   t = t.trim().toUpperCase();

//   let m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
//   if (m) {
//     let h = Number(m[1]), min = Number(m[2]);
//     if (m[3] === "PM" && h !== 12) h += 12;
//     if (m[3] === "AM" && h === 12) h = 0;
//     return h * 60 + min;
//   }

//   m = t.match(/^(\d{1,2})\s*(AM|PM)$/);
//   if (m) {
//     let h = Number(m[1]);
//     if (m[2] === "PM" && h !== 12) h += 12;
//     if (m[2] === "AM" && h === 12) h = 0;
//     return h * 60;
//   }

//   m = t.match(/^(\d{1,2}):(\d{2})$/);
//   if (m) return Number(m[1]) * 60 + Number(m[2]);

//   return null;
// }

// function minutesToISTDate(min, base) {
//   const d = new Date(base);
//   d.setMinutes(min);
//   return d;
// }

// // ================= CORE =================
// async function run() {
//   const sweeper = await Sweeper.findOne({ email: TARGET_EMAIL });

//   if (!sweeper) {
//     console.log("❌ Sweeper not found");
//     process.exit(1);
//   }

//   const startMin = parseDutyToMinutes(sweeper.dutyTime?.start);
//   const endMin = parseDutyToMinutes(sweeper.dutyTime?.end);

//   if (startMin == null || endMin == null || endMin <= startMin) {
//     console.log("❌ Invalid duty time");
//     process.exit(1);
//   }

//   const gap = Math.floor((endMin - startMin) / 3);

//   // 🔹 Date range: 19 Jan → Today (IST)
//   let current = getISTDate(new Date("2026-01-19T00:00:00+05:30"));
//   const today = getISTDate();

//   console.log(
//     `🛠 Seeding alarms for ${TARGET_EMAIL} from 19 Jan to ${dateKeyFromDate(today)}`
//   );

//   while (current <= today) {
//     const DATE_KEY = dateKeyFromDate(current);
//     const dayStart = istDayStart(DATE_KEY);
//     const dayEnd = new Date(dayStart.getTime() + 86400000);

//     console.log(`➡ Processing ${DATE_KEY}`);

//     // 🔥 Clean old data
//     await EventIndex.deleteMany({
//       sweeperId: sweeper._id,
//       dateKey: DATE_KEY
//     });

//     await Attendance.deleteMany({
//       sweeperId: sweeper._id,
//       date: { $gte: dayStart, $lt: dayEnd }
//     });

//     const events = [];

//     // 🔑 RULE: 2 or 3 attended (never below)
//     const attendedCount = Math.random() < 0.5 ? 2 : 3;
//     const attendedIndexes = new Set();

//     while (attendedIndexes.size < attendedCount) {
//       attendedIndexes.add(Math.floor(Math.random() * 3));
//     }

//     for (let i = 0; i < 3; i++) {
//       const t = minutesToISTDate(
//         startMin + gap * i + Math.floor(gap / 2),
//         dayStart
//       );

//       const id = new mongoose.Types.ObjectId().toString();
//       const attended = attendedIndexes.has(i);

//       const ev = {
//         id,
//         alarmTimestampMs: t.getTime(),
//         createdAt: t,
//         verificationStatus: attended ? "attended" : "missed",
//         verificationTimestampMs: attended ? t.getTime() : null,
//         opened: attended,
//         withinGeofence: attended ? true : null,
//         location: null
//       };

//       events.push(ev);

//       await EventIndex.create({
//         eventId: id,
//         sweeperId: sweeper._id,
//         dateKey: DATE_KEY,
//         storage: "sweeper",
//         createdAt: t
//       });
//     }

//     await Sweeper.updateOne(
//       { _id: sweeper._id },
//       { $set: { [`alarmEvents.${DATE_KEY}`]: events } }
//     );

//     current.setDate(current.getDate() + 1);
//   }

//   console.log("✅ DONE: Every day has 2 or 3 attended alarms.");
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
const TARGET_EMAIL = "sanjaykamble17";

// ================= DATE HELPERS =================
function getISTDate(d = new Date()) {
  return new Date(d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

function dateKeyFromDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function istDayStart(key) {
  return new Date(`${key}T00:00:00+05:30`);
}

// ================= TIME =================
function parseDutyToMinutes(t) {
  if (!t) return null;
  t = t.toUpperCase().trim();
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
  if (!sweeper) throw "Sweeper not found";

  const startMin = parseDutyToMinutes(sweeper.dutyTime?.start);
  const endMin = parseDutyToMinutes(sweeper.dutyTime?.end);
  if (!startMin || !endMin || endMin <= startMin) throw "Invalid duty time";

  const gap = Math.floor((endMin - startMin) / 3);

  let current = getISTDate(new Date("2026-01-19T00:00:00+05:30"));
  const today = getISTDate();

  while (current <= today) {
    const DATE_KEY = dateKeyFromDate(current);
    const dayStart = istDayStart(DATE_KEY);
    const dayEnd = new Date(dayStart.getTime() + 86400000);

    console.log(`➡ ${DATE_KEY}`);

    // 🔥 CLEAN PREVIOUS DATA
    await EventIndex.deleteMany({ sweeperId: sweeper._id, dateKey: DATE_KEY });
    await Attendance.deleteMany({ sweeperId: sweeper._id, date: { $gte: dayStart, $lt: dayEnd } });

    // 🔑 attended = 2 or 3
    const attendedCount = Math.random() < 0.5 ? 2 : 3;
    const attendedSet = new Set();
    while (attendedSet.size < attendedCount) {
      attendedSet.add(Math.floor(Math.random() * 3));
    }

    const events = [];
    let lastAlarmTime = null;

    for (let i = 0; i < 3; i++) {
      const t = minutesToDate(startMin + gap * i + Math.floor(gap / 2), dayStart);
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

    // 🔁 UPDATE (NOT APPEND) ALARMS
    await Sweeper.updateOne(
      { _id: sweeper._id },
      { $set: { [`alarmEvents.${DATE_KEY}`]: events } }
    );

    // ✅ ATTENDANCE — AFTER 3rd ALARM
    if (attendedCount >= 2 && lastAlarmTime >= dayStart && lastAlarmTime <= dayEnd) {
      await Attendance.create({
        sweeperId: sweeper._id,
        date: lastAlarmTime,
        location: null,
        createdAt: lastAlarmTime
      });
    }

    current.setDate(current.getDate() + 1);
  }

  console.log("✅ Alarms + Attendance FIXED & SYNCED");
  process.exit(0);
}

run().catch(err => {
  console.error("❌ FAILED:", err);
  process.exit(1);
});
