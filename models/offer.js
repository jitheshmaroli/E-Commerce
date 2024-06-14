const mongoose = require("mongoose");

const offerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    discountType: {
      type: String,
      required: true,
      enum: ["percentage", "amount"],
    },
    discountValue: {
      type: Number,
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    offerType: {
      type: String,
      required: true,
      enum: ["product", "category", "referral"],
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "product",
      required: function () {
        return this.offerType === "product";
      },
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "category",
      required: function () {
        return this.offerType === "category";
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const Offer = mongoose.model("Offer", offerSchema);

module.exports = Offer;