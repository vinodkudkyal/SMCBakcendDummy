/* indexdb_Version2_Version3.js
   Updates in this version:
   - De-duplicate /alarm-events: do not create a new event if an unopened/unverified event exists within a short time window
   - Compute and persist `withinGeofence` on verification (server-side polygon check against Sweeper.geofence)
   - Keep events nested by sweeper document per dateKey (no separate alarmevents doc creation for normal flow)
*/
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");

const app = express();
app.use(cors());
app.use(express.json());

// =======================================================================
//  MONGO CONNECTION
// =======================================================================
// const MONGO_URI =
//   "mongodb+srv://nagarshuddhismc_db_user:KU0RkVNSLcm23rkc@cluster0.7h8qa0n.mongodb.net/nagarshuddhi?retryWrites=true&w=majority&appName=Cluster0";
//   "mongodb+srv://vinodkudkyal05_db_user:S5uyYxwVgdiIS9av@cluster0.pyl5tmk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

const MONGO_URI =
  "mongodb+srv://vinodkudkyal05_db_user:S5uyYxwVgdiIS9av@cluster0.pyl5tmk.mongodb.net/nagarshuddhi?retryWrites=true&w=majority&appName=Cluster0";


// mongoose
//   .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
//   .then(() => console.log("✅ Connected to MongoDB"))
//   .catch((err) => {
//     console.error("❌ MongoDB connection error:", err);
//     process.exit(1);
//   });
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });


// =======================================================================
//  SOCKET.IO
// =======================================================================
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  console.log("🔌 socket connected:", socket.id);
  socket.on("disconnect", () => console.log("🔌 socket disconnected:", socket.id));
});

// helper
function emitEvent(name, payload) {
  try {
    io.emit(name, payload);
  } catch (e) {
    console.error("Socket emit error:", e);
  }
}

// =======================================================================
//  SCHEMAS — MERGED FROM OLD + NEW
// =======================================================================

// ---------------- USER ----------------
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  role: String,
  name: String,
});
const User = mongoose.model("User", userSchema);

// ---------------- SWEEPER ----------------
const sweeperSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  geofence: { type: Array, default: [] },
  checkpoints: { type: Array, default: [] },
  dutyTime: {
    start: { type: String, default: null },
    end: { type: String, default: null },
  },
  alarmEvents: { type: Object, default: {} }, // { 'YYYY-MM-DD': [ { id, alarmTimestampMs, ... } ] }
  partitions: { type: Object, default: {} },
});
const Sweeper = mongoose.model("Sweeper", sweeperSchema);

// ---------------- EVENT INDEX ----------------
// NOTE: eventId remains unique. We will de-duplicate event creation so this won't grow unexpectedly.
const eventIndexSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true, index: true },
  sweeperId: { type: mongoose.Schema.Types.ObjectId, ref: "Sweeper", required: true },
  dateKey: { type: String, required: true },
  storage: { type: String, enum: ["sweeper", "group", "old"], default: "sweeper" },
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: "AlarmEventGroup", default: null },
  createdAt: { type: Date, default: Date.now },
});
const EventIndex = mongoose.model("EventIndex", eventIndexSchema, "eventindexes");

// ---------------- ALARM EVENT GROUP (legacy support only if needed) ----------------
const alarmEventGroupSchema = new mongoose.Schema({
  sweeperId: { type: mongoose.Schema.Types.ObjectId, ref: "Sweeper", required: true, index: true },
  dateKey: { type: String, required: true, index: true },
  events: { type: Array, default: [] },
  updatedAt: { type: Date, default: Date.now },
});
const AlarmEventGroup = mongoose.model("AlarmEventGroup", alarmEventGroupSchema, "alarmeventgroups");

// ---------------- FACE DATA ----------------
const faceDataSchema = new mongoose.Schema({
  sweeperId: { type: mongoose.Schema.Types.ObjectId, ref: "Sweeper" },
  name: String,
  faceData: String,
  createdAt: { type: Date, default: Date.now },
});
const FaceData = mongoose.model("FaceData", faceDataSchema);

// ---------------- ATTENDANCE ----------------
const attendanceSchema = new mongoose.Schema({
  sweeperId: { type: mongoose.Schema.Types.ObjectId, ref: "Sweeper" },
  date: Date,
  location: { latitude: Number, longitude: Number },
  createdAt: { type: Date, default: Date.now },
});
const Attendance = mongoose.model("Attendance", attendanceSchema);

// ---------------- GEOFENCE ----------------
const geofenceSchema = new mongoose.Schema({
  name: String,
  zone: String,
  landmark: String,
  geofence: Array,
  checkpoints: Array,
  createdAt: { type: Date, default: Date.now },
});
const Geofence = mongoose.model("Geofence", geofenceSchema);

// ---------------- ALARM EVENTS — OLD VERSION (legacy only) ----------------
const alarmEventSchema = new mongoose.Schema({
  sweeperId: String,
  alarmTimestampMs: Number,
  opened: Boolean,
  openedTimestampMs: Number,
  responseMs: Number,
  verificationTimestampMs: Number,
  verificationStatus: String,
  note: String,
  location: {
    latitude: Number,
    longitude: Number
  },
  withinGeofence: { type: Boolean, default: null },
  createdAt: { type: Date, default: Date.now },
});
alarmEventSchema.index({ sweeperId: 1, alarmTimestampMs: -1 });

const AlarmEvent = mongoose.model("AlarmEvent", alarmEventSchema, "alarmevents");

// =======================================================================
//  HELPERS
// =======================================================================
function yyyymmddFromMs(ms) {
  const d = new Date(Number(ms));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function normalizeGeofencePoints(raw) {
  const out = [];
  if (!Array.isArray(raw)) return out;
  for (const p of raw) {
    if (p && typeof p === "object") {
      if (p.lat != null && p.lng != null) {
        out.push({ latitude: Number(p.lat), longitude: Number(p.lng) });
      } else if (p.latitude != null && p.longitude != null) {
        out.push({ latitude: Number(p.latitude), longitude: Number(p.longitude) });
      }
    }
  }
  return out;
}

// point-in-polygon using ray casting (latitude=y, longitude=x)
function isPointInPolygon(point, polygon) {
  if (!Array.isArray(polygon) || polygon.length < 3) return false;
  let intersectCount = 0;
  for (let j = 0; j < polygon.length; j++) {
    const k = (j + 1) % polygon.length;
    const latJ = polygon[j].latitude;
    const latK = polygon[k].latitude;
    const lngJ = polygon[j].longitude;
    const lngK = polygon[k].longitude;
    const condition1 = (latJ > point.latitude) !== (latK > point.latitude);
    const denom = (latK - latJ);
    const slope = denom === 0 ? Infinity : (lngK - lngJ) * (point.latitude - latJ) / denom;
    if (condition1 && (point.longitude < slope + lngJ)) {
      intersectCount++;
    }
  }
  return (intersectCount % 2 === 1);
}

// =======================================================================
//  ROUTES
// =======================================================================

app.get("/", (req, res) => {
  res.json({ success: true, message: "Sweeper Tracker API running" });
});

// LOGIN
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    let user = await User.findOne({ email, password }).lean();
    if (user)
      return res.json({
        success: true,
        role: user.role,
        name: user.name,
        id: user._id,
      });

    let sweeper = await Sweeper.findOne({ email, password }).lean();
    if (sweeper)
      return res.json({
        success: true,
        role: "sweeper",
        name: sweeper.name,
        id: sweeper._id,
      });

    res.status(401).json({ success: false, message: "Invalid credentials" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// SWEEPERS
app.get("/sweepers", async (req, res) => {
  try {
    res.json({ success: true, sweepers: await Sweeper.find().lean() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/sweepers", async (req, res) => {
  try {
    const { name, email, password, zone, status } = req.body;

    const exists = await Sweeper.findOne({ email });
    if (exists)
      return res.json({ success: false, message: "Email already exists" });

    const sweeper = await new Sweeper({
      name,
      email,
      password,
      zone,
      status
    }).save();

    emitEvent("sweeper:added", { sweeper });

    res.json({ success: true, sweeper });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete("/sweepers/:id", async (req, res) => {
  try {
    await Sweeper.findByIdAndDelete(req.params.id);
    await FaceData.deleteOne({ sweeperId: req.params.id });
    await Attendance.deleteMany({ sweeperId: req.params.id });
    await AlarmEvent.deleteMany({ sweeperId: req.params.id });
    await EventIndex.deleteMany({ sweeperId: req.params.id });
    await AlarmEventGroup.deleteMany({ sweeperId: req.params.id });

    emitEvent("sweeper:deleted", { id: req.params.id });

    res.json({ success: true, message: "Sweeper deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ASSIGNMENT
app.get("/sweepers/:id/assignment", async (req, res) => {
  try {
    const s = await Sweeper.findById(req.params.id).lean();
    if (!s)
      return res.status(404).json({ success: false, message: "Sweeper not found" });

    res.json({
      success: true,
      geofence: s.geofence,
      checkpoints: s.checkpoints,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put("/sweepers/:id/assignment", async (req, res) => {
  try {
    const s = await Sweeper.findByIdAndUpdate(
      req.params.id,
      { geofence: req.body.geofence, checkpoints: req.body.checkpoints },
      { new: true }
    );

    emitEvent("sweeper:updated", { sweeper: s });

    res.json({ success: true, sweeper: s });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DUTY TIME
app.put("/sweepers/:id/duty-time", async (req, res) => {
  try {
    const s = await Sweeper.findByIdAndUpdate(
      req.params.id,
      { dutyTime: req.body },
      { new: true }
    );

    emitEvent("sweeper:duty-time-updated", {
      id: req.params.id,
      dutyTime: s.dutyTime,
    });

    res.json({ success: true, dutyTime: s.dutyTime });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// FACE DATA
app.get("/sweepers/facedata/:id", async (req, res) => {
  try {
    const data = await FaceData.findOne({ sweeperId: req.params.id }).lean();
    res.json({
      success: true,
      hasFaceData: !!data,
      faceData: data?.faceData || null,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/sweepers/facedata/:id", async (req, res) => {
  try {
    const s = await Sweeper.findById(req.params.id);
    if (!s) return res.json({ success: false, message: "Sweeper not found" });

    let data = await FaceData.findOne({ sweeperId: req.params.id });

    if (!data) {
      data = await new FaceData({
        sweeperId: req.params.id,
        name: req.body.name,
        faceData: req.body.faceData,
      }).save();
    } else {
      data.name = req.body.name;
      data.faceData = req.body.faceData;
      await data.save();
    }

    res.json({ success: true, faceData: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ATTENDANCE
app.post("/sweepers/attendance", async (req, res) => {
  try {
    const { sweeperId, date, location } = req.body;

    const providedDate = date ? new Date(date) : new Date();

    const dayStart = new Date(providedDate);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    let existing = await Attendance.findOne({
      sweeperId,
      date: { $gte: dayStart, $lt: dayEnd },
    });

    if (existing)
      return res.json({
        success: true,
        message: "Attendance already marked",
        attendance: existing,
      });

    const attendance = await new Attendance({
      sweeperId,
      date: providedDate,
      location,
    }).save();

    emitEvent("attendance:marked", { sweeperId, attendance });

    res.json({ success: true, attendance });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/sweepers/:id/attendance", async (req, res) => {
  try {
    const q = { sweeperId: req.params.id };

    if (req.query.from || req.query.to) {
      q.date = {};
      if (req.query.from) q.date.$gte = new Date(req.query.from);
      if (req.query.to) q.date.$lte = new Date(req.query.to);
    }

    const data = await Attendance.find(q).sort({ date: -1 }).lean();
    res.json({ success: true, attendanceHistory: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// =======================================================================
//  ALARM EVENTS — NEW VERSION (embedded inside sweeper document)
// =======================================================================

/**
 * De-duplication: returns an existing event inside the sweeper's dateKey bucket if:
 * - exists within `thresholdMs` of provided alarmTimestampMs AND
 * - not opened AND has no verification timestamp
 */
function findNearDuplicateEvent(eventsArr, alarmTs, thresholdMs = 5000) {
  if (!Array.isArray(eventsArr)) return null;
  const target = Number(alarmTs || Date.now());
  for (const ev of eventsArr) {
    const t = Number(ev.alarmTimestampMs || 0);
    const unopened = ev.opened !== true;
    const unverified = !ev.verificationTimestampMs;
    if (unopened && unverified && Math.abs(t - target) <= thresholdMs) {
      return ev;
    }
  }
  return null;
}

app.post("/alarm-events", async (req, res) => {
  try {
    const { sweeperId, alarmTimestampMs, location } = req.body;

    const s = await Sweeper.findById(sweeperId);
    if (!s)
      return res.json({ success: false, message: "Sweeper not found" });

    const dateKey = yyyymmddFromMs(alarmTimestampMs || Date.now());

    // Ensure date bucket exists
    if (!s.alarmEvents[dateKey]) s.alarmEvents[dateKey] = [];

    // De-duplication: if an unopened/unverified event exists within 5s, return it instead of creating a new one.
    const dup = findNearDuplicateEvent(s.alarmEvents[dateKey], alarmTimestampMs, 5000);
    if (dup) {
      return res.json({ success: true, event: dup, dateKey, deduped: true });
    }

    // Create a new event
    const id = new mongoose.Types.ObjectId().toString();
    const evt = {
      id,
      alarmTimestampMs: Number(alarmTimestampMs || Date.now()),
      opened: false,
      openedTimestampMs: null,
      responseMs: null,
      verificationTimestampMs: null,
      verificationStatus: 'missed', // default missed until verification
      location: location || null,
      withinGeofence: null, // set on verification when we have location
      createdAt: new Date(),
    };

    s.alarmEvents[dateKey].push(evt);
    await s.save();

    // Add to EventIndex for fast lookup
    try {
      await EventIndex.create({
        eventId: id,
        sweeperId: s._id,
        dateKey,
        storage: 'sweeper',
      });
    } catch (e) {
      // ignore dup/index errors
    }

    emitEvent("alarmevent:created", { alarmevent: evt, sweeperId });

    res.json({ success: true, event: evt, dateKey });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// Backward compatible merged endpoint (kept as-is)
async function getMergedAlarmEventsForSweeper(sweeperId, fromMs = null, toMs = null) {
  const oldEvents = await AlarmEvent.find({ sweeperId }).lean().catch(() => []);
  const filteredOld = oldEvents.filter(ev => {
    const t = Number(ev.alarmTimestampMs || 0);
    if (fromMs && t < fromMs) return false;
    if (toMs && t > toMs) return false;
    return true;
  });

  const sweeper = await Sweeper.findById(sweeperId).lean();

  let embeddedEvents = [];
  if (sweeper?.alarmEvents) {
    for (const [dateKey, list] of Object.entries(sweeper.alarmEvents)) {
      if (!Array.isArray(list)) continue;

      list.forEach(ev => {
        const t = Number(ev.alarmTimestampMs || 0);
        if (fromMs && t < fromMs) return;
        if (toMs && t > toMs) return;
        embeddedEvents.push({
          ...ev,
          _id: ev.id,
          sweeperId
        });
      });
    }
  }

  const groups = await AlarmEventGroup.find({ sweeperId }).lean().catch(() => []);
  let groupedEvents = [];
  for (const g of groups) {
    const list = Array.isArray(g.events) ? g.events : [];
    list.forEach(ev => {
      const t = Number(ev.alarmTimestampMs || 0);
      if (fromMs && t < fromMs) return;
      if (toMs && t > toMs) return;
      groupedEvents.push({
        ...ev,
        _id: ev.id,
        sweeperId
      });
    });
  }

  const merged = [...filteredOld, ...embeddedEvents, ...groupedEvents];
  merged.sort((a, b) => (b.alarmTimestampMs || 0) - (a.alarmTimestampMs || 0));
  return merged;
}

app.get("/sweepers/:id/alarmevents", async (req, res) => {
  try {
    const sweeperId = req.params.id;
    const { from, to } = req.query;
    const fromMs = from ? Number(from) : null;
    const toMs = to ? Number(to) : null;

    const merged = await getMergedAlarmEventsForSweeper(sweeperId, fromMs, toMs);
    return res.json(merged);
  } catch (err) {
    console.error("Error fetching merged alarm events:", err);
    return res.status(500).json({ error: err.message });
  }
});

// hyphenated route
app.get("/sweepers/:id/alarm-events", async (req, res) => {
  try {
    const sweeperId = req.params.id;
    const { from, to } = req.query;
    const fromMs = from ? Number(from) : null;
    const toMs = to ? Number(to) : null;

    const merged = await getMergedAlarmEventsForSweeper(sweeperId, fromMs, toMs);
    return res.json(merged);
  } catch (err) {
    console.error("Error fetching merged alarm events (hyphen route):", err);
    return res.status(500).json({ error: err.message });
  }
});

// findEmbeddedEventById
async function findEmbeddedEventById(eventId) {
  try {
    const idx = await EventIndex.findOne({ eventId }).lean();
    if (!idx) return null;

    if ((idx.storage || 'sweeper') === 'sweeper') {
      const sweeper = await Sweeper.findById(idx.sweeperId).lean();
      if (!sweeper) return null;
      const arr = sweeper.alarmEvents && sweeper.alarmEvents[idx.dateKey] ? sweeper.alarmEvents[idx.dateKey] : [];
      const ev = Array.isArray(arr) ? arr.find(x => String(x.id) === String(eventId)) : null;
      if (!ev) return null;
      return { kind: 'sweeper', sweeper, dateKey: idx.dateKey, event: ev };
    } else if (idx.storage === 'group' && idx.groupId) {
      const group = await AlarmEventGroup.findById(idx.groupId).lean();
      if (!group) return null;
      const arr = Array.isArray(group.events) ? group.events : [];
      const ev = arr.find(x => String(x.id) === String(eventId));
      if (!ev) return null;
      return { kind: 'group', group, dateKey: idx.dateKey, event: ev };
    } else {
      try {
        const ae = await AlarmEvent.findById(eventId).lean();
        if (ae) return { kind: 'old', event: ae };
      } catch (_) {}
      return null;
    }
  } catch (e) {
    console.error("EventIndex lookup error:", e);
    return null;
  }
}

app.put("/alarm-events/:id/open", async (req, res) => {
  try {
    const eventId = req.params.id;
    const openedTimestampMs = req.body.openedTimestampMs ? Number(req.body.openedTimestampMs) : Date.now();

    // Try old collection first
    let ae = null;
    try {
      ae = await AlarmEvent.findOne({ $or: [{ _id: eventId }, { id: eventId }] });
    } catch (_) {
      ae = null;
    }

    if (ae) {
      ae.opened = true;
      ae.openedTimestampMs = openedTimestampMs;
      if (ae.alarmTimestampMs) {
        ae.responseMs = (ae.openedTimestampMs || Date.now()) - (ae.alarmTimestampMs || 0);
      }
      await ae.save();
      return res.json({ success: true, event: ae });
    }

    const found = await findEmbeddedEventById(eventId);
    if (found) {
      if (found.kind === 'sweeper') {
        const s = await Sweeper.findById(found.sweeper._id);
        const arr = s.alarmEvents[found.dateKey];
        if (Array.isArray(arr)) {
          const idx = arr.findIndex(x => String(x.id) === String(eventId));
          if (idx !== -1) {
            s.alarmEvents[found.dateKey][idx].opened = true;
            s.alarmEvents[found.dateKey][idx].openedTimestampMs = openedTimestampMs;
            const alarmTs = s.alarmEvents[found.dateKey][idx].alarmTimestampMs;
            if (alarmTs) {
              s.alarmEvents[found.dateKey][idx].responseMs = openedTimestampMs - Number(alarmTs);
            }
            await s.save();
            return res.json({ success: true, event: s.alarmEvents[found.dateKey][idx] });
          }
        }
      } else if (found.kind === 'group') {
        const g = await AlarmEventGroup.findById(found.group._id);
        if (g) {
          const idx = g.events.findIndex(x => String(x.id) === String(eventId));
          if (idx !== -1) {
            g.events[idx].opened = true;
            g.events[idx].openedTimestampMs = openedTimestampMs;
            const alarmTs = g.events[idx].alarmTimestampMs;
            if (alarmTs) {
              g.events[idx].responseMs = openedTimestampMs - Number(alarmTs);
            }
            g.updatedAt = new Date();
            await g.save();
            return res.json({ success: true, event: g.events[idx] });
          }
        }
      }
    }

    return res.status(404).json({ success: false, message: "Event not found" });
  } catch (err) {
    console.error("Error marking event open:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * Verify endpoint:
 * - Records verificationTimestampMs and verificationStatus (use 'attended' for success)
 * - If location provided and sweeper has a geofence, computes withinGeofence and persists it
 */
app.put("/alarm-events/:id/verify", async (req, res) => {
  try {
    const eventId = req.params.id;
    const verificationTimestampMs = req.body.verificationTimestampMs ? Number(req.body.verificationTimestampMs) : Date.now();
    const status = req.body.status ? String(req.body.status) : 'attended'; // default to attended
    const location = req.body.location || null;

    // Helper to compute withinGeofence if possible
    async function computeWithinGeofenceForSweeper(sweeperId, loc) {
      try {
        if (!loc || typeof loc !== 'object') return null;
        const s = await Sweeper.findById(sweeperId).lean();
        if (!s) return null;
        const poly = normalizeGeofencePoints(s.geofence);
        if (poly.length < 3) return null;
        const pt = {
          latitude: Number(loc.latitude || 0),
          longitude: Number(loc.longitude || 0),
        };
        return isPointInPolygon(pt, poly);
      } catch {
        return null;
      }
    }

    // Try old collection first
    let ae = null;
    try {
      ae = await AlarmEvent.findOne({ $or: [{ _id: eventId }, { id: eventId }] });
    } catch (_) {
      ae = null;
    }

    if (ae) {
      ae.verificationTimestampMs = verificationTimestampMs;
      ae.verificationStatus = status;
      if (location && typeof location === 'object') {
        ae.location = {
          latitude: Number(location.latitude || null),
          longitude: Number(location.longitude || null)
        };
      }
      const within = await computeWithinGeofenceForSweeper(ae.sweeperId, location);
      if (within !== null) ae.withinGeofence = !!within;
      await ae.save();
      return res.json({ success: true, event: ae });
    }

    // Embedded/group via EventIndex
    const found = await findEmbeddedEventById(eventId);
    if (found) {
      if (found.kind === 'sweeper') {
        const s = await Sweeper.findById(found.sweeper._id);
        const arr = s.alarmEvents[found.dateKey];
        if (Array.isArray(arr)) {
          const idx = arr.findIndex(x => String(x.id) === String(eventId));
          if (idx !== -1) {
            s.alarmEvents[found.dateKey][idx].verificationTimestampMs = verificationTimestampMs;
            s.alarmEvents[found.dateKey][idx].verificationStatus = status;
            if (location && typeof location === 'object') {
              s.alarmEvents[found.dateKey][idx].location = {
                latitude: Number(location.latitude || null),
                longitude: Number(location.longitude || null)
              };
              const within = await computeWithinGeofenceForSweeper(found.sweeper._id, location);
              if (within !== null) s.alarmEvents[found.dateKey][idx].withinGeofence = !!within;
            }
            await s.save();
            return res.json({ success: true, event: s.alarmEvents[found.dateKey][idx] });
          }
        }
      } else if (found.kind === 'group') {
        const g = await AlarmEventGroup.findById(found.group._id);
        if (g) {
          const idx = g.events.findIndex(x => String(x.id) === String(eventId));
          if (idx !== -1) {
            g.events[idx].verificationTimestampMs = verificationTimestampMs;
            g.events[idx].verificationStatus = status;
            if (location && typeof location === 'object') {
              g.events[idx].location = {
                latitude: Number(location.latitude || null),
                longitude: Number(location.longitude || null)
              };
              const within = await computeWithinGeofenceForSweeper(found.group.sweeperId, location);
              if (within !== null) g.events[idx].withinGeofence = !!within;
            }
            g.updatedAt = new Date();
            await g.save();
            return res.json({ success: true, event: g.events[idx] });
          }
        }
      }
    }

    return res.status(404).json({ success: false, message: "Event not found" });
  } catch (err) {
    console.error("Error recording verification:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PARTITIONS save/get (unchanged)
app.put("/sweepers/:id/partitions", async (req, res) => {
  try {
    const sweeperId = req.params.id;
    const { dateKey, partitions } = req.body;

    if (!Array.isArray(partitions) || partitions.length === 0) {
      return res.status(400).json({ success: false, message: "Partitions must be a non-empty array" });
    }

    const s = await Sweeper.findById(sweeperId);
    if (!s) return res.status(404).json({ success: false, message: "Sweeper not found" });

    let key = dateKey;
    if (!key) {
      const firstStartMs = Number(partitions[0].startMs || Date.now());
      const d = new Date(firstStartMs);
      key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    }

    const stored = partitions.map(p => ({
      startMs: Number(p.startMs),
      endMs: Number(p.endMs),
      createdAt: new Date(),
    }));

    if (!s.partitions) s.partitions = {};
    s.partitions[key] = stored;

    await s.save();

    console.log(`Saved partitions for sweeper=${sweeperId} date=${key} partitions=`, stored);

    emitEvent("sweeper:partitions-saved", { sweeperId, dateKey: key });

    res.json({ success: true, dateKey: key });
  } catch (err) {
    console.error("Error saving partitions:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/sweepers/:id/partitions", async (req, res) => {
  try {
    const sweeperId = req.params.id;
    const dateKey = req.query.dateKey;

    const s = await Sweeper.findById(sweeperId).lean();
    if (!s) return res.status(404).json({ success: false, message: "Sweeper not found" });

    if (!s.partitions) return res.json({ success: true, partitions: {} });

    if (dateKey) {
      const partsForDate = s.partitions[dateKey] || [];
      return res.json({ success: true, dateKey, partitions: partsForDate });
    }

    return res.json({ success: true, partitions: s.partitions });
  } catch (err) {
    console.error("Error fetching partitions:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GEOFENCE routes unchanged
app.post("/geofences", async (req, res) => {
  try {
    const gf = await new Geofence(req.body).save();
    res.json({ success: true, geofence: gf });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

app.get("/geofences", async (req, res) => {
  try {
    const data = await Geofence.find().lean();
    res.json({ success: true, geofences: data });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

app.get("/geofences/:id", async (req, res) => {
  try {
    const data = await Geofence.findById(req.params.id).lean();
    if (!data)
      return res.json({ success: false, message: "Geofence not found" });

    res.json({ success: true, geofence: data });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

app.delete("/geofences/:id", async (req, res) => {
  try {
    const gf = await Geofence.findByIdAndDelete(req.params.id);
    if (!gf)
      return res.json({ success: false, message: "Geofence not found" });

    res.json({ success: true, message: "Geofence deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// START SERVER
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 SERVER + SOCKET.IO RUNNING ON http://0.0.0.0:${PORT}`)
);