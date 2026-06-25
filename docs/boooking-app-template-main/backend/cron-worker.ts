// /src/cron-worker.ts
import dotenv from "dotenv";
import path from "path";
import cron from "node-cron";
import connectToDatabase from "./config/coreDb";
import checkinReminderEmail from "./utils/checkinReminderEmailTemplate";

// models imports below




// email template
// import checkinReminderEmail from "./utils/checkinReminderEmailTemplate";

// --- 1. Load Environment Variables ---
// Load environment variables
if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: path.resolve(__dirname, "../.env.production") });
} else if (process.env.NODE_ENV === "development") {
  dotenv.config({ path: path.resolve(__dirname, "../.env.development") });
} else {
  dotenv.config({ path: path.resolve(__dirname, "../.env.staging") });
}

const SCHEDULE_TIME: string = "11:00";
// ---  Parse the time and create the cron schedule string ---
const [hour, minute] = SCHEDULE_TIME.split(":");
const schedule = `${minute} ${hour} * * *`; // e.g., "15 16 * * *"


const sendDailyEmail = async () => {
  try {
    const now = new Date();
    //  Create a formatter for the "Europe/Rome" timezone
    //    We use 'fr-FR' or 'de-DE' as a locale to get DD-MM-YYYY format.
    const formatter = new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Rome",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    // 3. Format the date and replace slashes with dashes
    const todayString = formatter.format(now).replace(/\//g, "-");
    console.log(
      `[CRON] Running daily ${SCHEDULE_TIME} job for date: ${todayString}`
    );
    // Find bookings for today document for the current day
    const bookingsToNotify: {email: string, name: string}[] = []
    //Logic to retrievebooking

    // TODO: send the emails to the mailingList 

    
    // ... (Your email logic here) ...
    console.log(`[CRON] Daily ${SCHEDULE_TIME} job completed.`);
  } catch (error) {
    console.error(`[CRON] Error during daily ${SCHEDULE_TIME} job:`, error);
  }
};


console.log("Starting cron worker...");
connectToDatabase(process.env.DB_URL as string)
  .then(() => {
    console.log("Cron worker connected to database.");

    // Schedule job to run at 11:00 AM in Europe/Rome
    cron.schedule(
      schedule,
      () => {
        sendDailyEmail();
      },
      {
        timezone: "Europe/Rome",
      }
    );

    console.log(`Cron job scheduled for ${SCHEDULE_TIME} (Europe/Rome).`);

  })
  .catch((error) => {
    console.error("Cron worker failed to connect to database:", error);
    process.exit(1);
  });
