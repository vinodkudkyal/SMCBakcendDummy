// ==============================
// index.js (UPDATED)
// ==============================

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
const MONGO_URI =
  "mongodb+srv://nagarshuddhismc_db_user:KU0RkVNSLcm23rkc@cluster0.7h8qa0n.mongodb.net/nagarshuddhi?retryWrites=true&w=majority&appName=Cluster0";

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
const io = new Server(server, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  console.log("🔌 socket connected:", socket.id);
});

// =======================================================================
//  SCHEMAS
// =======================================================================

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  role: String,
  name: String,
});
const User = mongoose.model("User", userSchema);

const sweeperSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  geofence: Array,
  checkpoints: Array,
  dutyTime: Object,
  alarmEvents: Object,
  partitions: Object,
});
const Sweeper = mongoose.model("Sweeper", sweeperSchema);

const eventIndexSchema = new mongoose.Schema({
  eventId: { type: String, unique: true },
  sweeperId: { type: mongoose.Schema.Types.ObjectId, ref: "Sweeper" },
  dateKey: String,
  storage: String,
  createdAt: { type: Date, default: Date.now },
});
const EventIndex = mongoose.model(
  "EventIndex",
  eventIndexSchema,
  "eventindexes"
);

// =======================================================================
//  BASIC ROUTE
// =======================================================================
app.get("/", (req, res) => {
  res.json({ success: true, message: "Sweeper Tracker API running" });
});

// =======================================================================
//  ✅ NEW REPORT ENDPOINT (THIS IS THE IMPORTANT PART)
// =======================================================================
/**
 * USERS WHO GOT AT LEAST ONE ALARM
 * Source of truth: eventindexes
 */
app.get("/reports/users-with-alarms", async (req, res) => {
  try {
    // 1. Get distinct sweeperIds from eventindexes
    const sweeperIds = await EventIndex.distinct("sweeperId");

    // 2. Fetch sweeper details
    const sweepers = await Sweeper.find(
      { _id: { $in: sweeperIds } },
      { name: 1, email: 1 }
    ).lean();

    res.json({
      success: true,
      count: sweepers.length,
      users: sweepers,
    });
  } catch (err) {
    console.error("Report error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// =======================================================================
//  SERVER START
// =======================================================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`)
);
