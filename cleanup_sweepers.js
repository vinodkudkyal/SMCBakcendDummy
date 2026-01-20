const mongoose = require("mongoose");

/* ================== MONGO CONNECTION ================== */
const MONGO_URI =
  "mongodb+srv://vinodkudkyal05_db_user:S5uyYxwVgdiIS9av@cluster0.pyl5tmk.mongodb.net/nagarshuddhi?retryWrites=true&w=majority&appName=Cluster0";

/* ================== ALLOWED SWEEPERS (71 + 11) ================== */
const ALLOWED_EMAILS = [
  // ----- FIRST LIST (71) -----
  "adarsh@smc.com",
  "akshaykambale123",
  "atishkuchekar@123",
  "vickygaikwad1577@smc.com",
  "tanojkadam@smc.com",
  "lakhangavli@smc.com",
  "gangaram@smc.com",
  "anand@smc.com",
  "sameershaikh@smc.com",
  "raju@smc.com",
  "anandg@smc.com",
  "kartik@smc.com",
  "vishnu@gmail.com 25",
  "yogeshajadhav33",
  "ashokgaikwad33",
  "aniketlokhande33",
  "sachinjogdiya33",
  "uttamkasabe33",
  "swapnil@gmail.com25",
  "prakash20@smc.com",
  "venkateshdevnallu29@gmail.com",
  "prasanna123@smc.com",
  "dhiraj21@smc.com",
  "gorakhmaske28",
  "jaynarsingyenmul@smc.com",
  "sunil21@smc.com",
  "kuramyya46",
  "nitinbansode10",
  "govindgaikwad@123",
  "kailaswaghamare28",
  "bhadangerohan555@gmail.com",
  "shadhikant@smc.com",
  "isak46",
  "vasimshaikh28",
  "pandurangd@gmail.com",
  "padmackomallu@gmail.com",
  "lalushaikh28",
  "suvarnagudshellu@smc30.com",
  "uasha116",
  "parmeshwarkamble@smc30.com",
  "santoshgade@smc30.com",
  "bibimshaikh@smc30.com",
  "nagnath gaikwad",
  "anirudhamaske28",
  "mahesh khodake",
  "sangram akhade",
  "vivektalbhandare28",
  "dayabansode@smc30.com",
  "ajaysakhare@123",
  "surekha@smc.com",
  "ajitnagtilk@smc.com",
  "dipmalasarvgod@smc.com",
  "sanjaymane@smc.com",
  "suvarna@1234",
  "santoshwaghmare@smc.com",
  "dharma20@smc.com",
  "meerasmc@1",
  "anil gaikwad 41",
  "manojpedellu28",
  "sanjaychinapaga28",
  "sunitagejge143@gmail.com",
  "rameshg@smc20",
  "sushantfatake@123",
  "shital26@smc.com",
  "ramchandrachandanshive26@gmail.com",
  "sharadjanne26@gmail.com",
  "akash@smc.com",
  "test1@smc.com",
  "sample",
  "keep@smc.com",
  "test2@smc.com",

  // ----- SECOND LIST (11) -----
  "surajgavali@smc.com",
  "sandeepgade@smc.com",
  "dhanajilonde@012",
  "kavitasolanki@016",
  "sanjaykamble17",
  "avinashsarwade20@smc.com",
  "arun20@smc.com",
  "amarsonakambale28",
  "kiranmaidangirkar26@gmail.com",
  "dhirajhuwale44",
  "vijaykongari44",
].map(e => e.trim().toLowerCase());

/* ================== MODELS (MINIMAL) ================== */
const Sweeper = mongoose.model(
  "Sweeper",
  new mongoose.Schema({ email: String }),
  "sweepers"
);

const FaceData = mongoose.model("FaceData", new mongoose.Schema({ sweeperId: mongoose.Schema.Types.ObjectId }));
const Attendance = mongoose.model("Attendance", new mongoose.Schema({ sweeperId: mongoose.Schema.Types.ObjectId }));
const AlarmEvent = mongoose.model("AlarmEvent", new mongoose.Schema({ sweeperId: String }), "alarmevents");
const EventIndex = mongoose.model("EventIndex", new mongoose.Schema({ sweeperId: mongoose.Schema.Types.ObjectId }), "eventindexes");
const AlarmEventGroup = mongoose.model("AlarmEventGroup", new mongoose.Schema({ sweeperId: mongoose.Schema.Types.ObjectId }), "alarmeventgroups");

/* ================== CLEANUP ================== */
async function cleanup() {
  await mongoose.connect(MONGO_URI);
  console.log("✅ MongoDB connected");

  const sweepers = await Sweeper.find({}, { email: 1 }).lean();

  const toDelete = sweepers.filter(s =>
    !ALLOWED_EMAILS.includes((s.email || "").trim().toLowerCase())
  );

  console.log(`🧹 Total sweepers in DB: ${sweepers.length}`);
  console.log(`❌ Sweepers to delete: ${toDelete.length}`);
  console.log(`✅ Sweepers to keep: ${sweepers.length - toDelete.length}`);

  for (const s of toDelete) {
    const id = s._id;

    await FaceData.deleteMany({ sweeperId: id });
    await Attendance.deleteMany({ sweeperId: id });
    await EventIndex.deleteMany({ sweeperId: id });
    await AlarmEventGroup.deleteMany({ sweeperId: id });
    await AlarmEvent.deleteMany({ sweeperId: String(id) });
    await Sweeper.deleteOne({ _id: id });

    console.log(`❌ Deleted: ${s.email}`);
  }

  console.log("🎯 FINAL CLEANUP COMPLETED");
  process.exit(0);
}

cleanup().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
