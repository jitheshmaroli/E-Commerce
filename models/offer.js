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
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "category",
    },
    applyToAllProducts: {
      type: Boolean,
      default: false,
    },
    applyToAllCategories: {
      type: Boolean,
      default: false,
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