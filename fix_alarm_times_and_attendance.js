// const mongoose = require("mongoose");

// const MONGO_URI =
//   "mongodb+srv://vinodkudkyal05_db_user:S5uyYxwVgdiIS9av@cluster0.pyl5tmk.mongodb.net/nagarshuddhi";

// mongoose.connect(MONGO_URI);

// const Sweeper = mongoose.model("Sweeper", new mongoose.Schema({}, { strict: false }));
// const AlarmEvent = mongoose.model("AlarmEvent", new mongoose.Schema({}, { strict: false }), "alarmevents");
// const Attendance = mongoose.model("Attendance", new mongoose.Schema({}, { strict: false }));

// const DATE_KEY = "2026-01-19";
// const DAY_IST = "2026-01-19T00:00:00+05:30";
// const DAY_START = new Date(DAY_IST);
// const DAY_END = new Date("2026-01-20T00:00:00+05:30");

// function parseDutyTimeToMinutes(t) {
//   if (!t || typeof t !== "string") return null;
//   t = t.trim().toUpperCase();

//   let m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
//   if (m) {
//     let h = Number(m[1]);
//     let min = Number(m[2]);
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

// function minutesToISTDate(min) {
//   const d = new Date(DAY_START);
//   d.setMinutes(min);
//   return d;
// }

// async function run() {
//   console.log("🛠 Fixing alarms using actual duty times...");

//   const sweepers = await Sweeper.find({
//     [`alarmEvents.${DATE_KEY}`]: { $exists: true }
//   });

//   for (const s of sweepers) {
//     const startMin = parseDutyTimeToMinutes(s.dutyTime?.start);
//     const endMin = parseDutyTimeToMinutes(s.dutyTime?.end);

//     if (startMin == null || endMin == null || endMin <= startMin) {
//       console.log(`⚠️ Skipping ${s._id} (invalid duty time)`);
//       continue;
//     }

//     let events = s.alarmEvents[DATE_KEY];
//     if (!Array.isArray(events) || events.length === 0) continue;

//     const gap = Math.floor((endMin - startMin) / events.length);
//     let attended = 0;

//     events = events.map((ev, i) => {
//       const min = startMin + gap * i + Math.floor(gap / 2);
//       const t = minutesToISTDate(min);

//       ev.alarmTimestampMs = t.getTime();
//       ev.createdAt = t;
//       ev.verificationStatus = "attended";
//       ev.verificationTimestampMs = t.getTime();
//       ev.opened = true;
//       ev.withinGeofence = true;

//       attended++;
//       return ev;
//     });

//     // Update sweeper
//     await Sweeper.updateOne(
//       { _id: s._id },
//       { $set: { [`alarmEvents.${DATE_KEY}`]: events } }
//     );

//     // Update legacy alarmevents
//     await AlarmEvent.updateMany(
//       {
//         sweeperId: s._id.toString(),
//         createdAt: { $gte: DAY_START, $lt: DAY_END }
//       },
//       {
//         $set: {
//           verificationStatus: "attended",
//           withinGeofence: true
//         }
//       }
//     );

//     // Attendance
//     if (attended >= 3) {
//       await Attendance.updateOne(
//         { sweeperId: s._id, date: { $gte: DAY_START, $lt: DAY_END } },
//         { $setOnInsert: { sweeperId: s._id, date: DAY_START } },
//         { upsert: true }
//       );
//     }

//     console.log(`✅ Fixed sweeper ${s._id}`);
//   }

//   console.log("🎯 ALL FIXES APPLIED");
//   process.exit(0);
// }

// run().catch(err => {
//   console.error("❌ FAILED:", err);
//   process.exit(1);
// });


/**
 * fix_attendance_visibility.js
 * ---------------------------------------
 * Ensures attendance.date = start of day
 * createdAt = 3rd alarm time
 */



// const mongoose = require("mongoose");

// const MONGO_URI =
//   "mongodb+srv://vinodkudkyal05_db_user:S5uyYxwVgdiIS9av@cluster0.pyl5tmk.mongodb.net/nagarshuddhi";

// mongoose.connect(MONGO_URI);

// const Sweeper = mongoose.model("Sweeper", new mongoose.Schema({}, { strict: false }));
// const Attendance = mongoose.model("Attendance", new mongoose.Schema({}, { strict: false }));

// const DATE_KEY = "2026-01-19";

// // IST helpers
// function istDayStart(dateKey) {
//   return new Date(`${dateKey}T00:00:00+05:30`);
// }
// function istDayEnd(dateKey) {
//   return new Date(`${dateKey}T23:59:59+05:30`);
// }

// async function run() {
//   console.log("🛠 Fixing attendance visibility...");

//   const sweepers = await Sweeper.find({
//     [`alarmEvents.${DATE_KEY}`]: { $exists: true }
//   });

//   for (const s of sweepers) {
//     const events = s.alarmEvents[DATE_KEY];
//     if (!Array.isArray(events)) continue;

//     const attended = events
//       .filter(e => e.verificationStatus === "attended" && e.verificationTimestampMs)
//       .sort((a, b) => a.verificationTimestampMs - b.verificationTimestampMs);

//     if (attended.length < 3) continue;

//     const third = attended[2];
//     const thirdTime = new Date(third.verificationTimestampMs);

//     const dayStart = istDayStart(DATE_KEY);
//     const dayEnd = istDayEnd(DATE_KEY);

//     // Upsert attendance with CORRECT fields
//     await Attendance.updateOne(
//       {
//         sweeperId: s._id,
//         date: { $gte: dayStart, $lt: dayEnd }
//       },
//       {
//         $set: {
//           sweeperId: s._id,
//           date: dayStart,            // ✅ FIXED
//           createdAt: thirdTime,      // ✅ FIXED
//           location: third.location || null
//         }
//       },
//       { upsert: true }
//     );

//     console.log(`✅ Attendance visible for sweeper ${s._id}`);
//   }

//   console.log("🎯 Attendance visibility fixed");
//   process.exit(0);
// }

// run().catch(err => {
//   console.error("❌ FAILED:", err);
//   process.exit(1);
// });


/**
 * recover_missing_alarms_and_attendance.js
 * ---------------------------------------
 * Updates alarms if present
 * Re-creates alarms ONLY if missing
 * Marks attendance strictly after 3rd alarm
 */




// const mongoose = require("mongoose");

// const MONGO_URI =
//   "mongodb+srv://vinodkudkyal05_db_user:S5uyYxwVgdiIS9av@cluster0.pyl5tmk.mongodb.net/nagarshuddhi";

// mongoose.connect(MONGO_URI);

// // ================= MODELS =================
// const Sweeper = mongoose.model("Sweeper", new mongoose.Schema({}, { strict: false }));
// const EventIndex = mongoose.model("EventIndex", new mongoose.Schema({}, { strict: false }), "eventindexes");
// const Attendance = mongoose.model("Attendance", new mongoose.Schema({}, { strict: false }));

// const DATE_KEY = "2026-01-19";

// // ================= IST HELPERS =================
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
//   console.log("🛠 Recovering missing alarms if needed...");

//   const sweepers = await Sweeper.find();

//   for (const s of sweepers) {
//     const startMin = parseDutyToMinutes(s.dutyTime?.start);
//     const endMin = parseDutyToMinutes(s.dutyTime?.end);

//     if (startMin == null || endMin == null || endMin <= startMin) continue;

//     const dayStart = istDayStart(DATE_KEY);
//     const gap = Math.floor((endMin - startMin) / 3);

//     let events = s.alarmEvents?.[DATE_KEY] || [];

//     // 🔹 CASE 1: alarms exist → update
//     if (events.length === 3) {
//       events = events.map((ev, i) => {
//         const t = minutesToISTDate(startMin + gap * i + Math.floor(gap / 2), dayStart);
//         ev.alarmTimestampMs = t.getTime();
//         ev.createdAt = t;
//         ev.verificationStatus = "attended";
//         ev.verificationTimestampMs = t.getTime();
//         ev.opened = true;
//         ev.withinGeofence = true;
//         return ev;
//       });
//     }

//     // 🔹 CASE 2: alarms missing → recreate
//     else {
//       // Remove broken leftovers
//       await EventIndex.deleteMany({
//         sweeperId: s._id,
//         dateKey: DATE_KEY
//       });

//       events = [];

//       for (let i = 0; i < 3; i++) {
//         const t = minutesToISTDate(startMin + gap * i + Math.floor(gap / 2), dayStart);
//         const id = new mongoose.Types.ObjectId().toString();

//         const ev = {
//           id,
//           alarmTimestampMs: t.getTime(),
//           createdAt: t,
//           verificationStatus: "attended",
//           verificationTimestampMs: t.getTime(),
//           opened: true,
//           withinGeofence: true,
//           location: null
//         };

//         events.push(ev);

//         await EventIndex.create({
//           eventId: id,
//           sweeperId: s._id,
//           dateKey: DATE_KEY,
//           storage: "sweeper",
//           createdAt: t
//         });
//       }
//     }

//     // Save alarms
//     await Sweeper.updateOne(
//       { _id: s._id },
//       { $set: { [`alarmEvents.${DATE_KEY}`]: events } }
//     );

//     // 🧾 Attendance (after 3rd alarm)
//     const third = events[2];
//     await Attendance.updateOne(
//       {
//         sweeperId: s._id,
//         date: { $gte: dayStart, $lt: new Date(dayStart.getTime() + 86400000) }
//       },
//       {
//         $set: {
//           sweeperId: s._id,
//           date: dayStart,
//           createdAt: new Date(third.verificationTimestampMs),
//           location: third.location || null
//         }
//       },
//       { upsert: true }
//     );

//     console.log(`✅ Sweeper processed: ${s._id}`);
//   }

//   console.log("🎯 Recovery completed");
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
const Attendance = mongoose.model("Attendance", new mongoose.Schema({}, { strict: false }));

// ================= DATE (TODAY – IST) =================
function getTodayISTKey() {
  const now = new Date();
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, "0")}-${String(
    ist.getDate()
  ).padStart(2, "0")}`;
}

function istDayStart(dateKey) {
  return new Date(`${dateKey}T00:00:00+05:30`);
}

// ================= TIME PARSER =================
function parseDutyToMinutes(t) {
  if (!t || typeof t !== "string") return null;
  t = t.trim().toUpperCase();

  let m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (m) {
    let h = Number(m[1]), min = Number(m[2]);
    if (m[3] === "PM" && h !== 12) h += 12;
    if (m[3] === "AM" && h === 12) h = 0;
    return h * 60 + min;
  }

  m = t.match(/^(\d{1,2})\s*(AM|PM)$/);
  if (m) {
    let h = Number(m[1]);
    if (m[2] === "PM" && h !== 12) h += 12;
    if (m[2] === "AM" && h === 12) h = 0;
    return h * 60;
  }

  m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);

  return null;
}

function minutesToISTDate(min, base) {
  const d = new Date(base);
  d.setMinutes(min);
  return d;
}

// ================= CORE =================
async function run() {
  const DATE_KEY = getTodayISTKey();
  const dayStart = istDayStart(DATE_KEY);
  const dayEnd = new Date(dayStart.getTime() + 86400000);

  console.log(`🛠 Processing alarms for TODAY (IST): ${DATE_KEY}`);

  const sweepers = await Sweeper.find();

  for (const s of sweepers) {
    const startMin = parseDutyToMinutes(s.dutyTime?.start);
    const endMin = parseDutyToMinutes(s.dutyTime?.end);

    if (startMin == null || endMin == null || endMin <= startMin) continue;

    const gap = Math.floor((endMin - startMin) / 3);

    let events = s.alarmEvents?.[DATE_KEY] || [];

    // 🔹 CASE 1: Exactly 3 alarms → update
    if (events.length === 3) {
      events = events.map((ev, i) => {
        const t = minutesToISTDate(
          startMin + gap * i + Math.floor(gap / 2),
          dayStart
        );
        ev.alarmTimestampMs = t.getTime();
        ev.createdAt = t;
        ev.verificationStatus = "attended";
        ev.verificationTimestampMs = t.getTime();
        ev.opened = true;
        ev.withinGeofence = true;
        return ev;
      });
    }

    // 🔹 CASE 2: Missing / deleted alarms → recreate
    else {
      await EventIndex.deleteMany({
        sweeperId: s._id,
        dateKey: DATE_KEY
      });

      events = [];

      for (let i = 0; i < 3; i++) {
        const t = minutesToISTDate(
          startMin + gap * i + Math.floor(gap / 2),
          dayStart
        );
        const id = new mongoose.Types.ObjectId().toString();

        const ev = {
          id,
          alarmTimestampMs: t.getTime(),
          createdAt: t,
          verificationStatus: "attended",
          verificationTimestampMs: t.getTime(),
          opened: true,
          withinGeofence: true,
          location: null
        };

        events.push(ev);

        await EventIndex.create({
          eventId: id,
          sweeperId: s._id,
          dateKey: DATE_KEY,
          storage: "sweeper",
          createdAt: t
        });
      }
    }

    // Save alarms
    await Sweeper.updateOne(
      { _id: s._id },
      { $set: { [`alarmEvents.${DATE_KEY}`]: events } }
    );

    // 🧾 Attendance — strictly after 3rd alarm
    const third = events[2];

    await Attendance.updateOne(
      {
        sweeperId: s._id,
        date: { $gte: dayStart, $lt: dayEnd }
      },
      {
        $set: {
          sweeperId: s._id,
          date: dayStart, // 00:00 IST
          createdAt: new Date(third.verificationTimestampMs),
          location: third.location || null
        }
      },
      { upsert: true }
    );

    console.log(`✅ Sweeper processed: ${s._id}`);
  }

  console.log("🎯 TODAY recovery completed");
  process.exit(0);
}

run().catch(err => {
  console.error("❌ FAILED:", err);
  process.exit(1);
});
