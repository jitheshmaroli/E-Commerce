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
    const existCoupon = await Coupon.findOne({ code: code });
    if (existCoupon) {
      const message = "Coupon code already exists";
      res.render("admin/addCoupon", { message });
    } else {
      const expiryDateMidnight = new Date(expiryDate);
      expiryDateMidnight.setHours(23, 59, 59, 59);

      const newCoupon = {
        code: code.toUpperCase(),
        discount: discount,
        expiryDate: expiryDateMidnight,
      };
      await Coupon.create(newCoupon);
      res.redirect("/admin/couponlist");
    }
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal server error");
  }
};

const deleteCoupon = async (req, res) => {
  const { couponId } = req.params;
  console.log(couponId)

  try { 
    await Coupon.findByIdAndDelete(couponId);
    res.redirect('/admin/couponlist');
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const couponDiscount = async (req, res) => {
  const couponCode = req.params.couponCode;

  try {
    const coupon = await Coupon.findOne({ code: couponCode });

    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' });
    }

    const currentDate = new Date();
    if (currentDate > coupon.expiryDate) {
      return res.status(400).json({ error: 'Coupon expired' });
    }

    res.json({success: true, discount: coupon.discount });

  } catch (err) {
    console.error('Error checking coupon:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateCoupon = async (req, res) => {
  const couponId = req.params.couponId;
  try {
    const { code, discount, expiryDate } = req.body;
    const expiryDateMidnight = new Date(expiryDate);
    expiryDateMidnight.setHours(23, 59, 59, 59);

    // Check if the coupon exists
    const existingCoupon = await Coupon.findOne({ _id: couponId });
    if (!existingCoupon) {
      return res.status(404).json({ error: "Coupon not found" });
    }

    // Check if the code already exists
    const codeExists = await Coupon.exists({ code: code.toUpperCase(), _id: { $ne: couponId } });
    if (codeExists) {
      return res.status(400).json({ error: "Coupon code already exists" });
    }

    const couponUpdate = await Coupon.findOneAndUpdate(
      { _id: couponId },
      {
        $set: {
          code: code.toUpperCase(),
          discount: discount,
          expiryDate: expiryDateMidnight,
        },
      },
      { upsert: false, returnOriginal: false }
    );
    console.log(couponUpdate);

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
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
