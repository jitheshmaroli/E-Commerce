const User = require("../models/user");
const Category = require("../models/category");
const Addresses = require("../models/address");

const addressesView = async (req, res) => {
  try {
    const user = await User.findOne({
      email: req.session.userId || req.session.passport.user.userId,
    });

    const categoryList = await Category.find({ isBlocked: false });

    const addressDoc = await Addresses.findOne({ userId: user._id });

    let addresses = [];
    if (addressDoc) {
      addresses = addressDoc.address.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
    }

    res.render("users/address", {
      user,
      addresses: { address: addresses },
      categoryList,
    });
  } catch (error) {
    console.error("Addresses view error:", error);
    res.status(500).send("Internal server error");
  }
};

const addAddressView = async (req, res) => {
  try {
    const user = await User.findOne({
      email: req.session.userId || req.session.passport.user.userId,
    });
    const categoryList = await Category.find({ isBlocked: false });
    res.render("users/addAddress", { user, message: "", categoryList });
  } catch (error) {
    console.log(error);
    res.status(500).send("internal error");
  }
};

const addAddress = async (req, res) => {
  try {
    const user = await User.findOne({
      email: req.session.userId || req.session.passport.user.userId,
    });
    const { name, houseName, street, city, district, state, pinCode } = req.body;

    const newAddress = {
      name,
      houseName,
      street,
      city,
      district,
      state,
      pinCode,
    };

    let address = await Addresses.findOne({ userId: user._id });
    if (!address) {
      address = new Addresses({ userId: user._id, address: [] });
    }

    address.address.push(newAddress);

    await address.save();

    res.render("users/addAddress", {
      user,
      message: "Address added successfully",
    });
  } catch (error) {
    console.error("Error adding address:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const addNewAddress = async (req, res) => {
  try {
    const user = await User.findOne({
      email: req.session.userId || req.session.passport.user.userId,
    });
    const { name, houseName, street, city, district, state, pinCode, isDefault } = req.body;

    const newAddress = {
      name,
      houseName,
      street,
      city,
      district,
      state,
      pinCode,
      isDefault: isDefault === "true" || isDefault === true,
    };

    let addressDoc = await Addresses.findOne({ userId: user._id });
    if (!addressDoc) {
      addressDoc = new Addresses({ userId: user._id, address: [] });
    }

    if (newAddress.isDefault) {
      addressDoc.address.forEach((addr) => (addr.isDefault = false));
    }

    addressDoc.address.push(newAddress);
    await addressDoc.save();

    if (req.headers["content-type"] === "application/json") {
      return res.json({ success: true, message: "Address added successfully" });
    }

    res.redirect("/address");
  } catch (error) {
    console.error("Add address error:", error);
    if (req.headers["content-type"] === "application/json") {
      return res.status(500).json({ success: false, message: "Failed to add address" });
    }
    res.status(500).send("Internal server error");
  }
};

const setDefault = async (req, res) => {
  const { addressId } = req.body;

  try {
    const user = await User.findOne({
      email: req.session.userId || req.session.passport.user.userId,
    });

    const userId = user._id;

    await Addresses.updateOne({ userId }, { $set: { "address.$[].isDefault": false } });
    await Addresses.updateOne(
      { userId, "address._id": addressId },
      { $set: { "address.$.isDefault": true } }
    );

    res.json({ success: true, message: "Default address updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const editAddressView = async (req, res) => {
  try {
    const user = await User.findOne({
      email: req.session.userId || req.session.passport.user.userId,
    });

    const addressId = req.params.addressId;
    const addressDoc = await Addresses.findOne({ userId: user._id });
    const categoryList = await Category.find({ isBlocked: false });

    if (!addressDoc) {
      return res.status(404).json({ error: "No addresses found for this user" });
    }

    const address = addressDoc.address.find((addr) => addr._id.toString() === addressId);

    if (!address) {
      return res.status(404).json({ error: "Address not found" });
    }

    res.render("users/editAddress", {
      user,
      address,
      message: "",
      categoryList,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const updateAddress = async (req, res) => {
  const addressId = req.query.addressId;
  try {
    const user = await User.findOne({
      email: req.session.userId || req.session.passport.user.userId,
    });
    const addressDoc = await Addresses.findOne({ userId: user._id });

    if (!addressDoc) {
      return res.status(404).json({ success: false, message: "Address document not found" });
    }

    const addressIndex = addressDoc.address.findIndex((addr) => addr._id.toString() === addressId);
    if (addressIndex === -1) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    addressDoc.address[addressIndex].name = req.body.name;
    addressDoc.address[addressIndex].houseName = req.body.houseName;
    addressDoc.address[addressIndex].street = req.body.street;
    addressDoc.address[addressIndex].city = req.body.city;
    addressDoc.address[addressIndex].district = req.body.district;
    addressDoc.address[addressIndex].state = req.body.state;
    addressDoc.address[addressIndex].pinCode = req.body.pinCode;
    addressDoc.address[addressIndex].isDefault =
      req.body.isDefault === true || req.body.isDefault === true;

    if (req.body.isDefault) {
      addressDoc.address.forEach((address) => {
        if (address._id.toString() !== addressId) {
          address.isDefault = false;
        }
      });
    }
    await addressDoc.save();
    if (req.headers["content-type"] === "application/json") {
      return res.json({ success: true, message: "Address updated successfully" });
    }

    res.redirect("/address");
  } catch (error) {
    console.error("Update address error:", error);
    if (req.headers["content-type"] === "application/json") {
      return res.status(500).json({ success: false, message: "Failed to update address" });
    }
    res.status(500).send("Internal server error");
  }
};

const deleteAddress = async (req, res) => {
  try {
    const addressId = req.params.addressId;
    const user = await User.findOne({
      email: req.session.userId || req.session?.passport?.user?.userId,
    });

    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const addressDoc = await Addresses.findOne({ userId: user._id });
    if (!addressDoc) {
      return res.status(404).json({ success: false, message: "No addresses found" });
    }

    const addr = addressDoc.address.id(addressId);
    if (!addr) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    if (addr.isDefault) {
      return res.status(403).json({ success: false, message: "Cannot delete default address" });
    }

    addressDoc.address.pull(addressId);
    await addressDoc.save();

    res.json({ success: true, message: "Address deleted successfully" });
  } catch (error) {
    console.error("Delete address error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const getAddress = async (req, res) => {
  try {
    const addressId = req.params.addressId;
    const user = await User.findOne({
      email: req.session.userId || req.session.passport.user.userId,
    });
    const addressDoc = await Addresses.findOne({ userId: user._id });
    const address = addressDoc.address.id(addressId);
    res.json({ address });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  addAddress,
  addAddressView,
  addressesView,
  updateAddress,
  deleteAddress,
  addNewAddress,
  editAddressView,
  setDefault,
  getAddress,
};
