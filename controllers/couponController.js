const Coupon = require("../models/coupon");

const couponListView = async (req, res) => {
  try {
    const coupons = await Coupon.find({}).sort({ createdAt: -1 });
    res.render("admin/couponList", { coupons });
  } catch (error) {
    console.log(error);
    res.status(500).send("internal server error");
  }
};

const addCouponView = async (req, res) => {
  try {
    const coupons = await Coupon.find();
    res.render("admin/addCoupon", { coupons, message: "" });
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Internal Server Error");
  }
};

const addCoupon = async (req, res) => {
  try {
    const { code, discount, expiryDate } = req.body;

    if (!code || code.trim().length < 3 || !/[a-zA-Z]/.test(code)) {
      return res.status(400).json({ success: false, message: "Invalid coupon code" });
    }
    if (!discount || isNaN(discount) || discount < 1 || discount > 100) {
      return res.status(400).json({ success: false, message: "Invalid discount" });
    }
    if (!expiryDate || new Date(expiryDate) <= new Date()) {
      return res.status(400).json({ success: false, message: "Expiry date must be in the future" });
    }

    const existCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existCoupon) {
      return res.status(400).json({ success: false, message: "Coupon code already exists" });
    }

    const expiryDateMidnight = new Date(expiryDate);
    expiryDateMidnight.setHours(23, 59, 59, 999);

    await Coupon.create({
      code: code.toUpperCase(),
      discount: Number(discount),
      expiryDate: expiryDateMidnight,
    });

    res.status(201).json({ success: true, message: "Coupon added successfully" });
  } catch (error) {
    console.error("Add coupon error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
const deleteCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;

    const deleted = await Coupon.findByIdAndDelete(couponId);

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }

    res.json({ success: true, message: "Coupon deleted successfully" });
  } catch (error) {
    console.error("Delete coupon error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const couponDiscount = async (req, res) => {
  const couponCode = req.params.couponCode;

  try {
    const coupon = await Coupon.findOne({ code: couponCode });

    if (!coupon) {
      return res.status(404).json({ error: "Coupon not found" });
    }

    const currentDate = new Date();
    if (currentDate > coupon.expiryDate) {
      return res.status(400).json({ error: "Coupon expired" });
    }

    res.json({ success: true, discount: coupon.discount });
  } catch (err) {
    console.error("Error checking coupon:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

const updateCoupon = async (req, res) => {
  const couponId = req.params.couponId;
  try {
    const { code, discount, expiryDate } = req.body;

    if (!code || code.trim().length < 3 || code.trim().length > 5 || !/[a-zA-Z]/.test(code)) {
      return res.status(400).json({
        success: false,
        message: "Coupon code must be 3-5 chars with at least one letter",
      });
    }
    if (!discount || isNaN(discount) || discount < 1 || discount > 100) {
      return res
        .status(400)
        .json({ success: false, message: "Discount must be between 1 and 100" });
    }
    if (!expiryDate || new Date(expiryDate) <= new Date()) {
      return res.status(400).json({ success: false, message: "Expiry date must be in the future" });
    }

    const expiryDateMidnight = new Date(expiryDate);
    expiryDateMidnight.setHours(23, 59, 59, 999);

    const updated = await Coupon.findByIdAndUpdate(
      couponId,
      {
        code: code.toUpperCase(),
        discount: Number(discount),
        expiryDate: expiryDateMidnight,
      },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }

    res.json({ success: true, message: "Coupon updated successfully" });
  } catch (error) {
    console.error("Update coupon error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  deleteCoupon,
  couponListView,
  addCouponView,
  couponDiscount,
  addCoupon,
  updateCoupon,
};
