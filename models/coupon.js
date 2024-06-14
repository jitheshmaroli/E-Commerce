const mongoose = require("mongoose");
const coupon = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
      },
      discount: {
        type: Number,
        required: true,
      },
      expiryDate: {
        type: Date,
        required: true,
      },
},{timestamps:true});

const couponEntry = mongoose.model("coupon",coupon);

module.exports = couponEntry ;