const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    // eslint-disable-next-line no-undef
    await mongoose.connect(process.env.MONGO_URL,);
    console.log(`Mongodb Connected ${mongoose.connection.host}`);
  } catch (error) {
    console.log(`Mongodb error ${error}`);
  }
};

module.exports = {
    connectDB
};