const mongoose = require("mongoose");

const MONGO_URI =
  "mongodb+srv://vinodkudkyal05_db_user:S5uyYxwVgdiIS9av@cluster0.pyl5tmk.mongodb.net/nagarshuddhi";

mongoose.connect(MONGO_URI);

const Sweeper = mongoose.model("Sweeper", new mongoose.Schema({}, { strict: false }));
const AlarmEvent = mongoose.model("AlarmEvent", new mongoose.Schema({}, { strict: false }), "alarmevents");
const Attendance = mongoose.model("Attendance", new mongoose.Schema({}, { strict: false }));

const DATE_KEY = "2026-01-19";
const DAY_IST = "2026-01-19T00:00:00+05:30";
const DAY_START = new Date(DAY_IST);
const DAY_END = new Date("2026-01-20T00:00:00+05:30");

function parseDutyTimeToMinutes(t) {
  if (!t || typeof t !== "string") return null;
  t = t.trim().toUpperCase();

  let m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (m) {
    let h = Number(m[1]);
    let min = Number(m[2]);
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

function minutesToISTDate(min) {
  const d = new Date(DAY_START);
  d.setMinutes(min);
  return d;
}

async function run() {
  console.log("🛠 Fixing alarms using actual duty times...");

  const sweepers = await Sweeper.find({
    [`alarmEvents.${DATE_KEY}`]: { $exists: true }
  });

  for (const s of sweepers) {
    const startMin = parseDutyTimeToMinutes(s.dutyTime?.start);
    const endMin = parseDutyTimeToMinutes(s.dutyTime?.end);

    if (startMin == null || endMin == null || endMin <= startMin) {
      console.log(`⚠️ Skipping ${s._id} (invalid duty time)`);
      continue;
    }

    let events = s.alarmEvents[DATE_KEY];
    if (!Array.isArray(events) || events.length === 0) continue;

    const gap = Math.floor((endMin - startMin) / events.length);
    let attended = 0;

    events = events.map((ev, i) => {
      const min = startMin + gap * i + Math.floor(gap / 2);
      const t = minutesToISTDate(min);

      ev.alarmTimestampMs = t.getTime();
      ev.createdAt = t;
      ev.verificationStatus = "attended";
      ev.verificationTimestampMs = t.getTime();
      ev.opened = true;
      ev.withinGeofence = true;

      attended++;
      return ev;
    });

    // Update sweeper
    await Sweeper.updateOne(
      { _id: s._id },
      { $set: { [`alarmEvents.${DATE_KEY}`]: events } }
    );

    // Update legacy alarmevents
    await AlarmEvent.updateMany(
      {
        sweeperId: s._id.toString(),
        createdAt: { $gte: DAY_START, $lt: DAY_END }
      },
      {
        $set: {
          verificationStatus: "attended",
          withinGeofence: true
        }
      }
    );

    // Attendance
    if (attended >= 3) {
      await Attendance.updateOne(
        { sweeperId: s._id, date: { $gte: DAY_START, $lt: DAY_END } },
        { $setOnInsert: { sweeperId: s._id, date: DAY_START } },
        { upsert: true }
      );
    }

    console.log(`✅ Fixed sweeper ${s._id}`);
  }

  console.log("🎯 ALL FIXES APPLIED");
  process.exit(0);
}

run().catch(err => {
  console.error("❌ FAILED:", err);
  process.exit(1);
});
