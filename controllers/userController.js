const User = require("../models/user");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Category = require("../models/category");
const Wallet = require("../models/wallet");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../public/uploads"));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
});

const profilePhotoUpload = upload.array("profile-pic", 1);

const userProfileView = async (req, res) => {
  try {
    const user = await User.findOne({
      email: req.session.userId || req.session.passport.user.userId,
    });
    const categoryList = await Category.find({ isBlocked: false });
    res.render("users/userProfile", { user, categoryList });
  } catch (error) {
    console.log(error);
    res.status(500).send("internal error");
  }
};

const updateProfile = async (req, res) => {
  try {
    const user = await User.findOne({
      email: req.session.userId || req.session.passport.user.userId,
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { name, gender } = req.body;
    let isDataChanged = false;
    const updateObj = {};

    if (name && name.trim() && name !== user.name) {
      updateObj.name = name.trim();
      isDataChanged = true;
    }

    if (gender && gender !== user.gender) {
      updateObj.gender = gender;
      isDataChanged = true;
    }

    let uploadedPhoto = null;
    if (req.files && req.files.length > 0) {
      const newFile = req.files[0];
      uploadedPhoto = [
        {
          filename: newFile.filename,
          originalname: newFile.originalname,
          mimetype: newFile.mimetype,
        },
      ];
      updateObj.photo = uploadedPhoto;
      isDataChanged = true;

      if (user.photo && user.photo.length > 0) {
        const oldFilePath = path.join(__dirname, "../public/uploads", user.photo[0].filename);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
    }

    if (isDataChanged) {
      await User.findByIdAndUpdate(user._id, updateObj);
    } else {
      console.log("No changes to update.");
    }

    res.redirect("/profile?updated=true");
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const walletView = async (req, res) => {
  try {
    const user = await User.findOne({
      email: req.session.userId || req.session.passport.user.userId,
    }).populate({
      path: "walletTransactions",
      options: { sort: { createdAt: -1 } },
    });
    const categoryList = await Category.find({ isBlocked: false });
    res.render("users/wallet", { user, categoryList });
  } catch (error) {
    console.log(error);
    res.status(500).send("internal error");
  }
};

async function updateWallet(userId, amount, orderId, type) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const walletTransaction = new Wallet({
      userId: user._id,
      amount: amount,
      type: type,
      orderId: orderId,
    });

    if (type === "credit") {
      user.wallet += amount;
      walletTransaction.description = "Order refund";
    } else if (type === "debit") {
      user.wallet -= amount;
      walletTransaction.description = "Order payment";
    }

    await walletTransaction.save();

    user.walletTransactions.push(walletTransaction._id);

    await user.save();
  } catch (error) {
    console.error("Error processing refund:", error);
  }
}

module.exports = {
  userProfileView,
  updateProfile,
  profilePhotoUpload,
  walletView,
  updateWallet,
};
