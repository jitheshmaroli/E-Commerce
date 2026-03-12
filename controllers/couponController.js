const { HTTP_STATUS } = require("../constants/httpStatusCodes");
const Coupon = require("../models/coupon");

const couponListView = async (req, res) => {
  try {
    const coupons = await Coupon.find({}).sort({ createdAt: -1 });
    res.render("admin/couponList", { coupons });
  } catch (error) {
    console.log(error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send("internal server error");
  }
};

const addCouponView = async (req, res) => {
  try {
    const coupons = await Coupon.find();
    res.render("admin/addCoupon", { coupons, message: "" });
  } catch (error) {
    console.log(error.message);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send("Internal Server Error");
  }
};

const addCoupon = async (req, res) => {
  try {
    const { code, discount, startDate, expiryDate } = req.body;

    if (!code || code.trim().length < 3 || !/[a-zA-Z]/.test(code)) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ success: false, message: "Invalid coupon code" });
    }
    if (!discount || isNaN(discount) || discount < 1 || discount > 100) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ success: false, message: "Invalid discount" });
    }
    if (!startDate || !expiryDate) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ success: false, message: "Both start and expiry dates are required" });
    }

    const start = new Date(startDate);
    const expiry = new Date(expiryDate);

    if (isNaN(start) || isNaN(expiry)) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ success: false, message: "Invalid date format" });
    }
    if (start >= expiry) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ success: false, message: "Start date must be before expiry date" });
    }
    if (expiry <= new Date()) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ success: false, message: "Expiry date must be in the future" });
    }

    const existCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existCoupon) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ success: false, message: "Coupon code already exists" });
    }

    const expiryDateMidnight = new Date(expiry);
    expiryDateMidnight.setHours(23, 59, 59, 999);

    await Coupon.create({
      code: code.toUpperCase(),
      discount: Number(discount),
      startDate: start,
      expiryDate: expiryDateMidnight,
    });

    res.status(HTTP_STATUS.CREATED).json({ success: true, message: "Coupon added successfully" });
  } catch (error) {
    console.error("Add coupon error:", error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Internal server error" });
  }
};
const deleteCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;

    const deleted = await Coupon.findByIdAndDelete(couponId);

    if (!deleted) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ success: false, message: "Coupon not found" });
    }

    res.status(HTTP_STATUS.OK).json({ success: true, message: "Coupon deleted successfully" });
  } catch (error) {
    console.error("Delete coupon error:", error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Internal server error" });
  }
};

const couponDiscount = async (req, res) => {
  const couponCode = req.params.couponCode;

  try {
    const coupon = await Coupon.findOne({ code: couponCode });

    if (!coupon) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ error: "Coupon not found" });
    }

    const currentDate = new Date();
    if (currentDate > coupon.expiryDate) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: "Coupon expired" });
    }

    res.status(HTTP_STATUS.OK).json({ success: true, discount: coupon.discount });
  } catch (err) {
    console.error("Error checking coupon:", err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
  }
};

// Helper: strip time component for a date-only comparison
const toDateOnly = (d) => {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const updateCoupon = async (req, res) => {
  const { couponId } = req.params;
  try {
    const { code, discount, startDate, expiryDate } = req.body;

    // ── Field validation ───────────────────────────────────────────────
    if (!code || code.trim().length < 3 || code.trim().length > 5 || !/[a-zA-Z]/.test(code)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Coupon code must be 3–5 characters and contain at least one letter",
      });
    }
    if (!discount || isNaN(discount) || discount < 1 || discount > 100) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ success: false, message: "Discount must be between 1 and 100" });
    }
    if (!startDate || !expiryDate) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ success: false, message: "Both start and expiry dates are required" });
    }

    const submittedStart = new Date(startDate);
    const submittedExpiry = new Date(expiryDate);

    if (isNaN(submittedStart) || isNaN(submittedExpiry)) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ success: false, message: "Invalid date format" });
    }
    if (submittedStart >= submittedExpiry) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ success: false, message: "Start date must be before expiry date" });
    }

    // ── Fetch the existing coupon for comparison ───────────────────────
    const existing = await Coupon.findById(couponId);
    if (!existing) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ success: false, message: "Coupon not found" });
    }

    const now = new Date();
    const existingStartOnly = toDateOnly(existing.startDate);
    const existingExpiryOnly = toDateOnly(existing.expiryDate);
    const submittedStartOnly = toDateOnly(submittedStart);
    const submittedExpiryOnly = toDateOnly(submittedExpiry);

    const startDateChanged = submittedStartOnly.getTime() !== existingStartOnly.getTime();
    const expiryDateChanged = submittedExpiryOnly.getTime() !== existingExpiryOnly.getTime();

    // ── Date-change rules ──────────────────────────────────────────────

    // 1. Start date is in the past — block any attempt to change it
    if (startDateChanged && toDateOnly(now) > existingStartOnly) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message:
          "The start date is already in the past and cannot be changed. " +
          "If you need to extend the coupon, update only the End Date.",
      });
    }

    // 2. Start date is in the future — allow changing it, but not to the past
    if (startDateChanged && submittedStartOnly < toDateOnly(now)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Start date cannot be set to a past date.",
      });
    }

    // 3. Expiry date changed — must always be in the future
    if (expiryDateChanged && submittedExpiryOnly <= toDateOnly(now)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "End date must be a future date.",
      });
    }

    // 4. No date fields changed — skip all date checks entirely
    //    (user only updated code / discount — always allowed)

    // ── Duplicate code check — exclude the coupon being edited ─────────
    const normalizedCode = code.trim().toUpperCase();
    const duplicate = await Coupon.findOne({
      code: normalizedCode,
      _id: { $ne: couponId },
    });
    if (duplicate) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ success: false, message: "Another coupon with this code already exists" });
    }

    // ── Persist ────────────────────────────────────────────────────────
    const expiryDateMidnight = new Date(submittedExpiry);
    expiryDateMidnight.setHours(23, 59, 59, 999);

    const updated = await Coupon.findByIdAndUpdate(
      couponId,
      {
        code: normalizedCode,
        discount: Number(discount),
        startDate: submittedStart,
        expiryDate: expiryDateMidnight,
      },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ success: false, message: "Coupon not found" });
    }

    res.status(HTTP_STATUS.OK).json({ success: true, message: "Coupon updated successfully" });
  } catch (error) {
    console.error("Update coupon error:", error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Internal server error" });
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
