const Product = require("../models/product");
const path = require("path");
const multer = require("multer");
const Category = require("../models/category");
const { HTTP_STATUS } = require("../constants/httpStatusCodes");
const fs = require("fs").promises;

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../public/uploads"));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage });

const photoUpload = upload.array("photos", 4);

const addProductView = async (req, res) => {
  try {
    const categoryList = await Category.find({ isBlocked: false });
    res.render("admin/addProduct", { categoryList, message: "" });
  } catch (error) {
    console.log(error.message);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: "Internal Server Error" });
  }
};

const newProduct = async (req, res) => {
  try {
    const { name, description, category, brandName = "", stock, price, tags } = req.body;

    if (!name?.trim() || !category || !stock || !price) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Required fields missing (name, category, stock, price)",
      });
    }

    const stockNum = Number(stock);
    const priceNum = Number(price);

    if (isNaN(stockNum) || stockNum < 0) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ success: false, message: "Invalid stock value" });
    }
    if (isNaN(priceNum) || priceNum <= 0) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ success: false, message: "Invalid price value" });
    }

    const existing = await Product.findOne({ name: name.trim(), brandName: brandName.trim() });
    if (existing) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: "Product with this name and brand already exists",
      });
    }

    // Handle images
    let photos = [];
    if (req.files?.length === 4) {
      photos = req.files.map((file) => ({
        filename: file.filename,
        originalname: file.originalname,
        mimetype: file.mimetype,
      }));
    } else {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Exactly 4 images are required",
      });
    }

    const catDoc = await Category.findOne({ categoryName: category.trim() });
    if (!catDoc) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ success: false, message: "Invalid category" });
    }

    const product = new Product({
      name: name.trim(),
      description: (description || "").trim(),
      category: catDoc._id,
      brandName: brandName.trim(),
      stock: stockNum,
      price: priceNum,
      tags: tags
        ? tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
      photos,
    });

    await product.save();

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: "Product created successfully",
      productId: product._id,
    });
  } catch (err) {
    console.error("Add product error:", err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Server error while creating product",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

const updateProductView = async (req, res) => {
  try {
    const productData = await Product.findById(req.params.productId).populate("category");
    const categoryList = await Category.find({ isBlocked: false });

    if (!productData) {
      return res.status(HTTP_STATUS.NOT_FOUND).send("Product not found");
    }

    res.render("admin/updateProduct", { productData, categoryList });
  } catch (error) {
    console.log(error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send("Internal server error");
  }
};

const updateProduct = async (req, res) => {
  try {
    const productId = req.params.productId;
    const product = await Product.findById(productId);
    if (!product) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ success: false, message: "Product not found" });
    }

    const { name, description, category, brandName = "", stock, price, tags } = req.body;

    if (!name?.trim() || !category || !stock || !price) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ success: false, message: "Required fields missing" });
    }

    const catDoc = await Category.findOne({ categoryName: category.trim() });
    if (!catDoc) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ success: false, message: "Invalid category" });
    }

    product.name = name.trim();
    product.description = (description || "").trim();
    product.category = catDoc._id;
    product.brandName = brandName.trim();
    product.stock = Number(stock);
    product.price = Number(price);
    product.tags = tags
      ? tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : product.tags;

    let keptPhotos = [];
    if (req.body.existingPhotos) {
      const existing = Array.isArray(req.body.existingPhotos)
        ? req.body.existingPhotos
        : [req.body.existingPhotos];
      keptPhotos = product.photos.filter((p) => existing.includes(p.filename));
    }

    if (req.files?.length > 0) {
      const newOnes = req.files.map((f) => ({
        filename: f.filename,
        originalname: f.originalname,
        mimetype: f.mimetype,
      }));
      keptPhotos.push(...newOnes);
    }

    if (keptPhotos.length < 4) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ success: false, message: "At least four images are required" });
    }

    if (keptPhotos.length > 4) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Maximum 4 images allowed per product.",
      });
    }

    product.photos = keptPhotos;

    await product.save();

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Product updated successfully",
    });
  } catch (err) {
    console.error("Update product error:", err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Server error while updating product",
    });
  }
};

const removeImage = async (req, res) => {
  try {
    const { filename } = req.body;

    const imagePath = path.join("public/uploads", filename);
    fs.unlink(imagePath, (unlinkErr) => {
      if (unlinkErr) {
        console.error("Error removing file:", unlinkErr);
        return res
          .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
          .json({ error: "Failed to remove image" });
      }

      res.status(HTTP_STATUS.OK).json({ success: true, message: "Image removed successfully" });
    });
  } catch (error) {
    console.error("Error removing image:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: "Failed to remove image" });
  }
};

const updatePhotos = async (req, res) => {
  try {
    const { productId } = req.params;
    const { photos } = req.body;

    const product = await Product.findByIdAndUpdate(productId, { photos }, { new: true });

    if (!product) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ error: "Product not found" });
    }

    res.status(HTTP_STATUS.OK).json({ success: true, product });
  } catch (error) {
    console.error("Error updating product photos:", error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ error: "Failed to update product photos" });
  }
};

const allProducts = async (req, res) => {
  try {
    const products = await Product.find({ isDeleted: false }).populate("category");
    res.render("admin/allProducts", { products });
  } catch (error) {
    console.log(error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send("internal server error");
  }
};

const deleteProduct = async (req, res) => {
  try {
    const productId = req.params.productId;
    const productData = await Product.findOne({ _id: productId });
    if (productData) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ success: false, message: "Product not found" });
    }
    productData.isDeleted = true;
    await productData.save();
    res.status(HTTP_STATUS.OK).json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .render("userSide/error", { message: "Internal server error" });
  }
};

module.exports = {
  newProduct,
  addProductView,
  photoUpload,
  allProducts,
  updateProduct,
  updateProductView,
  deleteProduct,
  removeImage,
  updatePhotos,
};
