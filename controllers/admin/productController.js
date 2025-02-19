const Product = require("../../models/product");
const path = require("path");
const multer = require("multer");
const Category = require("../../models/category");
const fs = require("fs").promises;

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // eslint-disable-next-line no-undef
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
    res.render("admin/product/addProduct", { categoryList, message: "" });
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Internal Server Error");
  }
};

const newProduct = async (req, res) => {
  try {
    const { name, description, category, brandName, stock, price, tags } = req.body;

    if (!name || !category || !brandName || !stock || !price) {
      const categoryList = await Category.find();
      return res.render("admin/product/addProduct", {
        categoryList,
        message: "Incomplete data",
      });
    }

    const existingProduct = await Product.findOne({
      name: name,
      brandName: brandName,
    });

    if (!existingProduct) {
      let uploadedPhotos = [];
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {       
            uploadedPhotos.push({
              filename: file.filename,
              originalname: file.originalname,
              mimetype: 'image/jpeg',
            });
        }
      }

      const getCategoryObjectId = async (categoryName) => {
        const category = await Category.findOne({ categoryName: categoryName });
        return category ? category._id : null;
      };

      const categoryId = await getCategoryObjectId(category);

      const newProduct = new Product({
        name,
        description,
        category: categoryId,
        brandName,
        stock,
        price,
        tags,
        photos: uploadedPhotos,
      });

      await newProduct.save();

      res.redirect("/admin/allproducts");
      console.log("New product added");
    } else {
      res.redirect("/admin/allproducts");
      console.log("Product already exists");
    }
  } catch (error) {
    console.error("An error occurred while adding the product:", error.message);
    res.status(500).send("An error occurred while adding the product.");
  }
};

//update product view

const updateProductView = async (req, res) => {
  try {
    const productData = [
      await Product.findById(req.params.productId).populate("category"),
    ];
    const categoryList = await Category.find({ isBlocked: false });
    if (!productData) {
      return res.status(404).json({ message: "Product not found" });
    } else {
      res.render("admin/product/updateProduct", { productData, categoryList });
    }
  } catch (error) {
    console.log(error);
    res.status(500).send("internal server error");
  }
};
//update product data

const updateProduct = async (req, res) => {
  const productId = req.params.productId;
  const { existingPhotos } = req.body || [];
  const newPhotos = req.files || [];

  console.log("existing photos type:" + typeof(existingPhotos))

  try {
    console.log("trying");
    async function getCategoryObjectId(categoryName) {
      console.log("function called");
      const category = await Category.findOne({ categoryName: categoryName });
      console.log(`${category}:category`);
      console.log(`${categoryName}:category name`);
      return category ? category._id : null;
    }
    const categoryId = await getCategoryObjectId(req.body.category);
    console.log(categoryId);

    const product = await Product.findById(productId);
    product.name = req.body.name;
    product.description = req.body.description;
    product.category = categoryId;
    product.brandName = req.body.brandName;
    product.stock = req.body.stock;
    product.price = req.body.price;
    product.tags = req.body.tags;

   

    if (Array.isArray(newPhotos) && newPhotos.length > 0) {
      console.log("Adding new photos");
      newPhotos.forEach((photo) => {
        product.photos.push({
          filename: photo.filename,
          originalname: photo.originalname,
          mimetype: photo.mimetype,
        });
      });
    }

    console.log("updated product" + product);
    await product
      .save()
      .then(() => {
        console.log("Product updated successfully");
        res.redirect("/admin/allProducts");
      })
      .catch((error) => {
        console.error("Error updating product:", error);
        res.status(500).send("An error occurred while updating the product.");
      });
  } catch (error) {
    res.status(500).send(error);
  }
};

const removeImage =  async (req, res) => {
  try {
    console.log("image removing")
    const { filename } = req.body;

    const imagePath = path.join('public/uploads', filename);
    console.log(imagePath)
    fs.unlink(imagePath, (unlinkErr) => {
      if (unlinkErr) {
        console.error('Error removing file:', unlinkErr);
        return res.status(500).json({ error: 'Failed to remove image' });
      }


    res.status(200).json({success:true , message: 'Image removed successfully' });
    });
  } catch (error) {
    console.error('Error removing image:', error);
    res.status(500).json({ error: 'Failed to remove image' });
  }
};


const updatePhotos = async (req, res) => {
  try {
    const { productId } = req.params;
    const { photos } = req.body;

    const product = await Product.findByIdAndUpdate(productId, { photos }, { new: true });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.status(200).json({ success: true, product });
  } catch (error) {
    console.error('Error updating product photos:', error);
    res.status(500).json({ error: 'Failed to update product photos' });
  }
};

const allProducts = async (req, res) => {
  try {
    const products = await Product.find({ isDeleted: false }).populate('category');
    res.render("admin/product/allProducts", { products });
  } catch (error) {
    console.log(error);
    res.status(500).send("internal server error");
  }
};

const deleteProduct = async (req, res) => {
  try {
    const productId = req.params.productId;
    const productData = await Product.findOne({ _id: productId });
    if (productData) {
      productData.isDeleted = true;
      await productData.save();
    }
    res.redirect("/admin/allProducts");
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .render("error/500", { message: "Internal server error" });
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
  updatePhotos
};
