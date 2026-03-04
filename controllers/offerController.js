const Product = require("../models/product");
const Category = require("../models/category");
const Offer = require("../models/offer");
const { HTTP_STATUS } = require("../constants/httpStatusCodes");

const listOffers = async (req, res) => {
  const offers = await Offer.find();
  res.render("admin/offers/offersList", { offers });
};

const addOfferView = async (req, res) => {
  try {
    const products = await Product.find();
    const categories = await Category.find();
    res.render("admin/offers/addOffer", { products, categories, message: "" });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(error);
  }
};

const addOffer = async (req, res) => {
  try {
    let offerData = { ...req.body };

    if (!offerData.product || offerData.product === "" || offerData.product === "None") {
      delete offerData.product;
    }
    if (!offerData.category || offerData.category === "" || offerData.category === "None") {
      delete offerData.category;
    }

    if (offerData.product === "all") {
      offerData.product = null;
      offerData.applyToAllProducts = true;
    } else {
      offerData.applyToAllProducts = false;
    }
    if (offerData.category === "all") {
      offerData.category = null;
      offerData.applyToAllCategories = true;
    } else {
      offerData.applyToAllCategories = false;
    }

    const existingOffer = await Offer.findOne({
      name: offerData.name,
      offerType: offerData.offerType,
    });

    if (existingOffer) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ success: false, message: "Duplicate offer already exists." });
    }

    const newOffer = new Offer(offerData);
    await newOffer.save();

    res.status(HTTP_STATUS.CREATED).json({ success: true, message: "Offer created successfully" });
  } catch (error) {
    console.error("Add offer error:", error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message || "Failed to create offer" });
  }
};

const applyOffers = async function () {
  const activeOffers = await Offer.find({
    isActive: true,
    endDate: { $gte: new Date() },
  });

  const categoryOffers = activeOffers.filter((offer) => offer.offerType === "category");
  for (const offer of categoryOffers) {
    await applyCategoryOffer(offer);
  }

  const productOffers = activeOffers.filter((offer) => offer.offerType === "product");
  for (const offer of productOffers) {
    await applyProductOffer(offer);
  }
};

async function applyProductOffer(offer) {
  let products;
  if (offer.applyToAllProducts) {
    products = await Product.find();
  } else {
    products = await Product.find({ _id: offer.product });
  }
  for (const product of products) {
    const newPrice = calculateDiscountedPrice(product.price, offer);
    if (newPrice < product.currentPrice) {
      product.currentPrice = newPrice;
      product.offer = offer._id;
      await product.save();
    } else {
      product.currentPrice = product.price;
      await product.save();
    }
  }
}

async function applyCategoryOffer(offer) {
  let products;
  if (offer.applyToAllCategories) {
    products = await Product.find();
  } else {
    products = await Product.find({ category: offer.category });
  }

  for (const product of products) {
    const newPrice = calculateDiscountedPrice(product.price, offer);
    if (newPrice < product.currentPrice) {
      product.currentPrice = newPrice;
      product.offer = offer._id;
      await product.save();
    } else {
      product.currentPrice = product.price;
      await product.save();
    }
  }
}

function calculateDiscountedPrice(originalPrice, offer) {
  if (offer.discountType === "percentage") {
    return originalPrice * (1 - offer.discountValue / 100);
  } else {
    return Math.max(0, originalPrice - offer.discountValue);
  }
}

const getBestOffer = async function (product) {
  const productOffers = await Offer.find({
    $or: [
      { offerType: "product", product: product._id },
      { offerType: "product", applyToAllProducts: true },
    ],
    isActive: true,
    endDate: { $gte: new Date() },
  });

  const categoryOffers = await Offer.find({
    $or: [
      { offerType: "category", category: product.category },
      { offerType: "category", applyToAllCategories: true },
    ],
    isActive: true,
    endDate: { $gte: new Date() },
  });

  const allOffers = [...productOffers, ...categoryOffers];

  if (allOffers.length === 0) return null;

  let bestOffer = allOffers[0];
  let bestPrice = calculateDiscountedPrice(product.price, bestOffer);

  for (const offer of allOffers.slice(1)) {
    const currentPrice = calculateDiscountedPrice(product.price, offer);
    if (currentPrice < bestPrice) {
      bestPrice = currentPrice;
      bestOffer = offer;
    }
  }

  return bestOffer;
};

const editOfferView = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    const products = await Product.find();
    const categories = await Category.find();
    if (!offer) {
      return res.status(HTTP_STATUS.NOT_FOUND).send("Offer not found");
    }
    res.render("admin/offers/editOffer", { offer, products, categories });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(error);
  }
};

const updateOffer = async (req, res) => {
  try {
    const offerId = req.params.id;
    let updateData = { ...req.body };

    if (updateData.category === "" || updateData.category === "None") {
      delete updateData.category;
    }
    if (updateData.product === "" || updateData.product === "None") {
      delete updateData.product;
    }

    if (updateData.product === "all") {
      updateData.product = null;
      updateData.applyToAllProducts = true;
    } else {
      updateData.applyToAllProducts = false;
    }
    if (updateData.category === "all") {
      updateData.category = null;
      updateData.applyToAllCategories = true;
    } else {
      updateData.applyToAllCategories = false;
    }

    updateData.isActive = updateData.isActive === "on";

    const updatedOffer = await Offer.findByIdAndUpdate(offerId, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedOffer) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: "Offer not found" });
    }

    res.status(HTTP_STATUS.OK).json({ success: true, message: "Offer updated successfully" });
  } catch (error) {
    console.error("Update offer error:", error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message || "Failed to update offer" });
  }
};

const deleteOffer = async (req, res) => {
  try {
    const offerId = req.params.id;
    const deletedOffer = await Offer.findByIdAndDelete(offerId);
    if (!deletedOffer) {
      return res.status(HTTP_STATUS.NOT_FOUND).send("Offer not found");
    }
    res.status(HTTP_STATUS.OK).json({ success: true, message: "Offer deleted successfully" });
  } catch (error) {
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message || "Failed to delete offer" });
  }
};

module.exports = {
  addOfferView,
  addOffer,
  applyOffers,
  getBestOffer,
  calculateDiscountedPrice,
  listOffers,
  editOfferView,
  updateOffer,
  deleteOffer,
};
