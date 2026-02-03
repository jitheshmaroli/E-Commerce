const cron = require("node-cron");
const Offer = require("../models/offer");

cron.schedule(
  "0 0 * * *",
  async () => {
    try {
      const now = new Date();

      const expiredOffers = await Offer.updateMany(
        {
          endDate: { $lt: now },
          isActive: true,
        },
        { $set: { isActive: false } }
      );

      if (expiredOffers.modifiedCount > 0) {
        console.log(
          `[CRON] Deactivated ${expiredOffers.modifiedCount} expired offers at ${now.toISOString()}`
        );
      }
    } catch (err) {
      console.error("[CRON ERROR] Offer expiry job failed:", err);
    }
  },
  {
    timezone: "Asia/Kolkata",
  }
);
