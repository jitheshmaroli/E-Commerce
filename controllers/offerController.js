const Product = require('../models/product');
const Category = require('../models/category');
const Offer = require('../models/offer');

const listOffers = async (req, res) => {
  try {
      const offers = await Offer.find();
      res.render('admin/offers/offersList', { offers });
  } catch (error) {
      res.status(500).send(error);
  }
};

const addOfferView = async (req, res) => {
    try {
      const products = await Product.find();
      const categories = await Category.find();
      res.render("admin/offers/addOffer", { products, categories, message:'' });
    } catch (error) {
      res.status(500).send(error);}
};


const addOffer = async (req, res) => {
    const offerData = req.body;

    try {
        const existingOffer = await Offer.findOne({
            name: offerData.name,
            offerType: offerData.offerType,
        });

        if (existingOffer) {
            return res.status(400).send("Duplicate offer already exists.");
        }

         if (offerData.product === 'all') {
            offerData.product = null;
            offerData.applyToAllProducts = true;
        }
        if (offerData.category === 'all') {
            offerData.category = null;
            offerData.applyToAllCategories = true;
        }

        const newOffer = new Offer(offerData);
        await newOffer.save();
        res.redirect("/admin/offers");
    } catch (error) {
        res.status(400).send(error);
    }
};



const applyOffers = async function () {
    const activeOffers = await Offer.find({ isActive: true, endDate: { $gte: new Date() } });
    
    // Apply category offers first
    const categoryOffers = activeOffers.filter(offer => offer.offerType === 'category');
    for (const offer of categoryOffers) {
      await applyCategoryOffer(offer);
    }
    
    // Then apply product offers, which will override category offers if better
    const productOffers = activeOffers.filter(offer => offer.offerType === 'product');
    for (const offer of productOffers) {
      await applyProductOffer(offer);
    }
}

async function applyProductOffer(offer) {
  let products;  
  if (offer.applyToAllProducts) {
    products = await Product.find();
  } else {
    products = await Product.find({_id: offer.product});
  }
  for (const product of products) {
        const newPrice = calculateDiscountedPrice(product.price, offer);
        if (newPrice < product.currentPrice) {
            product.currentPrice = newPrice;
            product.offer = offer._id;
            await product.save();
        }else{
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
        }else{
            product.currentPrice = product.price;
            await product.save();
        }
    }
}

function calculateDiscountedPrice(originalPrice, offer) {
  if (offer.discountType === 'percentage') {
    return originalPrice * (1 - offer.discountValue / 100);
  } else {
    return Math.max(0, originalPrice - offer.discountValue);
  }
}

const getBestOffer = async function (product) {
  const productOffers = await Offer.find({
      $or: [
          { offerType: 'product', product: product._id },
          { offerType: 'product', applyToAllProducts: true }
      ],
      isActive: true,
      endDate: { $gte: new Date() }
  });

  const categoryOffers = await Offer.find({
      $or: [
          { offerType: 'category', category: product.category },
          { offerType: 'category', applyToAllCategories: true }
      ],
      isActive: true,
      endDate: { $gte: new Date() }
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
          return res.status(404).send('Offer not found');
      }
      res.render('admin/offers/editOffer', { offer, products, categories });
  } catch (error) {
      res.status(500).send(error);
  }
};

const updateOffer = async (req, res) => {
  try {
      const offerId = req.params.id;
      const updateData = req.body;

      if (updateData.product === 'all') {
          updateData.product = null;
          updateData.applyToAllProducts = true;
      } else {
          updateData.applyToAllProducts = false;
      }
      if (updateData.category === 'all') {
          updateData.category = null;
          updateData.applyToAllCategories = true;
      } else {
          updateData.applyToAllCategories = false;
      }

      updateData.isActive = updateData.isActive === 'on';

      const updatedOffer = await Offer.findByIdAndUpdate(offerId, updateData, { new: true });
      if (!updatedOffer) {
          return res.status(404).send('Offer not found');
      }
      res.redirect('/admin/offers');
  } catch (error) {
      res.status(400).send(error);
  }
};

const deleteOffer = async (req, res) => {
  try {
      const offerId = req.params.id;
      const deletedOffer = await Offer.findByIdAndDelete(offerId);
      if (!deletedOffer) {
          return res.status(404).send('Offer not found');
      }
      res.redirect('/admin/offers');
  } catch (error) {
      res.status(500).send(error);
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
    deleteOffer
}