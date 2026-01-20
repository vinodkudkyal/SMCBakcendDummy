/**
 * seedAlarmEvents.core.js
 * ---------------------------------------
 * ONE-TIME DATA SEED SCRIPT
 * - Only sweepers who already have alarms
 * - Exactly 3 events per sweeper
 * - Date: 19 Jan 2026
 * - Updates: sweepers, eventindexes, alarmevents
 */

const mongoose = require("mongoose");

// ======================
// MONGO CONNECTION
// ======================
const MONGO_URI =
    "mongodb+srv://vinodkudkyal05_db_user:S5uyYxwVgdiIS9av@cluster0.pyl5tmk.mongodb.net/nagarshuddhi?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGO_URI);

// ======================
// MODELS (MINIMAL)
// ======================
const Sweeper = mongoose.model(
    "Sweeper",
    new mongoose.Schema({}, { strict: false })
);

const EventIndex = mongoose.model(
    "EventIndex",
    new mongoose.Schema({}, { strict: false }),
    "eventindexes"
);

const AlarmEvent = mongoose.model(
    "AlarmEvent",
    new mongoose.Schema({}, { strict: false }),
    "alarmevents"
);

// ======================
// HELPERS
// ======================
const SEED_DATE_KEY = "2026-01-19";
const SEED_DATE_BASE = new Date("2026-01-19T00:00:00Z");

function timeToMinutes(t) {
    if (!t || typeof t !== "string") return null;

    t = t.trim().toUpperCase();

    // Handle AM/PM format
    const ampmMatch = t.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/);
    if (ampmMatch) {
        let h = Number(ampmMatch[1]);
        const m = Number(ampmMatch[2]);
        const ap = ampmMatch[3];

        if (h < 1 || h > 12 || m < 0 || m > 59) return null;
        if (ap === "PM" && h !== 12) h += 12;
        if (ap === "AM" && h === 12) h = 0;

        return h * 60 + m;
    }

    // Handle 24-hour format
    if (t.includes(":")) {
        const [h, m] = t.split(":").map(Number);
        if (
            Number.isNaN(h) ||
            Number.isNaN(m) ||
            h < 0 || h > 23 ||
            m < 0 || m > 59
        ) return null;

        return h * 60 + m;
    }

    return null;
}

function minutesToMs(m) {
    return m * 60 * 1000;
}

function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPointInGeofence(geo = []) {
    if (!geo.length) return null;

    const lats = geo.map(p => p.latitude);
    const lngs = geo.map(p => p.longitude);

    return {
        latitude: rand(
            Math.min(...lats) * 1e6,
            Math.max(...lats) * 1e6
        ) / 1e6,
        longitude: rand(
            Math.min(...lngs) * 1e6,
            Math.max(...lngs) * 1e6
        ) / 1e6
    };
}

// ======================
// CORE LOGIC
// ======================
async function runSeed() {
    console.log("🚀 Seeding alarms for existing-alarm sweepers only...");

    // 1️⃣ Get sweepers who already have alarms
    const sweeperIds = await EventIndex.distinct("sweeperId");

    const sweepers = await Sweeper.find({
        _id: { $in: sweeperIds }
    }).lean();

    console.log(`👥 Sweepers to process: ${sweepers.length}`);

    for (const s of sweepers) {
        if (!s.dutyTime?.start || !s.dutyTime?.end) {
            console.log(`⚠️ Skipped ${s._id} (no duty time)`);
            continue;
        }

        const startMin = timeToMinutes(s.dutyTime.start);
        const endMin = timeToMinutes(s.dutyTime.end);

        if (
            startMin === null ||
            endMin === null ||
            endMin <= startMin
        ) {
            console.log(
                `⚠️ Skipped ${s._id} (invalid duty time: ${s.dutyTime.start} → ${s.dutyTime.end})`
            );
            continue;
        }

        const total = endMin - startMin;

        if (total < 10) {
            console.log(
                `⚠️ Skipped ${s._id} (duty duration too short)`
            );
            continue;
        }

        const part = Math.floor(total / 3);

        const partitions = [
            [startMin, startMin + part],
            [startMin + part, startMin + part * 2],
            [startMin + part * 2, endMin]
        ];

        for (let i = 0; i < 3; i++) {
            const [pStart, pEnd] = partitions[i];
            const minute = rand(pStart, pEnd);

            const eventTime = new Date(
                SEED_DATE_BASE.getTime() + minutesToMs(minute)
            );

            const location = randomPointInGeofence(s.geofence);
            const eventId = new mongoose.Types.ObjectId().toString();

            // 2️⃣ alarmevents (legacy)
            await AlarmEvent.create({
                sweeperId: s._id.toString(),
                alarmTimestampMs: eventTime.getTime(),
                verificationStatus: "attended",
                opened: true,
                location,
                createdAt: eventTime
            });

            // 3️⃣ eventindexes
            await EventIndex.create({
                eventId,
                sweeperId: s._id,
                dateKey: SEED_DATE_KEY,
                storage: "sweeper",
                createdAt: eventTime
            });

            // 4️⃣ sweepers.alarmEvents
            await Sweeper.updateOne(
                { _id: s._id },
                {
                    $push: {
                        [`alarmEvents.${SEED_DATE_KEY}`]: {
                            id: eventId,
                            alarmTimestampMs: eventTime.getTime(),
                            verificationStatus: "attended",
                            opened: true,
                            location,
                            createdAt: eventTime
                        }
                    }
                }
            );

            console.log(
                `✅ Sweeper ${s._id} | Event ${i + 1} | ${eventTime.toISOString()}`
            );
        }
    }

    console.log("🎯 Seeding completed.");
    process.exit(0);
}

// ======================
runSeed().catch(err => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
});