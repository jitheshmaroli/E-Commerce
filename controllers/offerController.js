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
    console.log("offerdata:", offerData);

    if (!offerData.product || offerData.product === "" || offerData.product === "None") {
      delete offerData.product;
    }
    if (!offerData.category || offerData.category === "" || offerData.category === "None") {
      delete offerData.category;
    }

    if (offerData.offerType === "all-products") {
      offerData.product = null;
      offerData.category = null;
      offerData.applyToAllProducts = true;
      offerData.applyToAllCategories = false;
    } else if (offerData.offerType === "all-categories") {
      offerData.category = null;
      offerData.product = null;
      offerData.applyToAllCategories = true;
      offerData.applyToAllProducts = false;
    } else if (offerData.offerType === "product") {
      offerData.applyToAllProducts = false;
      offerData.applyToAllCategories = false;
    } else if (offerData.offerType === "category") {
      offerData.applyToAllProducts = false;
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
  const offers = await Offer.find({
    isActive: true,
    endDate: { $gte: new Date() },
  });

  const applicableOffers = offers.filter((offer) => {
    if (offer.offerType === "all-products") return true;

    if (offer.offerType === "all-categories") return true;

    if (offer.offerType === "product" && offer.product?.toString() === product._id.toString())
      return true;

    if (
      offer.offerType === "category" &&
      offer.category?.toString() === product.category.toString()
    )
      return true;

    return false;
  });

  if (!applicableOffers.length) return null;

  let bestOffer = applicableOffers[0];
  let bestPrice = calculateDiscountedPrice(product.price, bestOffer);

  for (const offer of applicableOffers.slice(1)) {
    const price = calculateDiscountedPrice(product.price, offer);
    if (price < bestPrice) {
      bestPrice = price;
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
    console.log("offerdata:", updateData);

    if (updateData.category === "" || updateData.category === "None") {
      delete updateData.category;
    }
    if (updateData.product === "" || updateData.product === "None") {
      delete updateData.product;
    }

    if (updateData.offerType === "all-products") {
      updateData.product = null;
      updateData.category = null;
      updateData.applyToAllProducts = true;
      updateData.applyToAllCategories = false;
    } else if (updateData.offerType === "all-categories") {
      updateData.product = null;
      updateData.category = null;
      updateData.applyToAllProducts = false;
      updateData.applyToAllCategories = true;
    } else if (updateData.offerType === "product") {
      updateData.applyToAllProducts = false;
      updateData.applyToAllCategories = false;
    } else if (updateData.offerType === "category") {
      updateData.applyToAllProducts = false;
      updateData.applyToAllCategories = false;
    }

    const requestedActive = updateData.isActive === "on";

    if (requestedActive) {
      // Use dates from the submitted form if present, else fall back to the
      // existing document so a pure status-toggle (no date change) still works.
      let startDate = updateData.startDate ? new Date(updateData.startDate) : null;
      let endDate = updateData.endDate ? new Date(updateData.endDate) : null;

      if (!startDate || !endDate) {
        const existing = await Offer.findById(offerId).select("startDate endDate");
        if (!existing) {
          return res
            .status(HTTP_STATUS.NOT_FOUND)
            .json({ success: false, message: "Offer not found" });
        }
        if (!startDate) startDate = new Date(existing.startDate);
        if (!endDate) endDate = new Date(existing.endDate);
      }

      const now = new Date();

      if (now < startDate) {
        const formatted = startDate.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: `This offer hasn't started yet — it is scheduled to begin on ${formatted}. Please update the Start Date to today or earlier if you want to activate it now.`,
        });
      }

      if (now > endDate) {
        const formatted = endDate.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: `This offer expired on ${formatted}. Please extend the End Date to a future date before activating it.`,
        });
      }
    }

    updateData.isActive = requestedActive;
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
