const Category = require("../models/category");
const Product = require("../models/product");

const categoryListView = async (req, res) => {
  try {
    const categoryList = await Category.find();

    res.render("admin/categoryList", { categoryList });
  } catch (error) {
    console.log(error);
    res.status(500).send("internal server error");
  }
};

const addCategoryView = async (req, res) => {
  try {
    res.render("admin/addcategory", { message: "" });
  } catch (error) {
    console.log(error);
    res.status(500).send("internal server error");
  }
};

const addCategory = async (req, res) => {
  try {
    const { categoryName, description } = req.body;
    if (!categoryName || !description) {
      return res.status(400).json({ success: false, message: "Incomplete details" });
    }

    const existingCategory = await Category.findOne({
      categoryName: categoryName,
    });

    if (existingCategory) {
      return res.status(400).json({ success: false, message: "Category already exists" });
    }

    const newCategory = new Category({
      categoryName,
      description,
      isBlocked: false,
    });

    await Category.create(newCategory);
    res.json({ success: true, message: "Category added successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to add category" });
  }
};

const editCategoryView = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const categoryList = await Category.findById(categoryId);

    res.render("admin/editCategory", { categoryList, message: "" });
  } catch (error) {
    console.log(error);
    res.status(500).send("internal server error");
  }
};

const editCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const { categoryName, description } = req.body;

    const existingCategory = await Category.findOne({
      categoryName: categoryName,
    });

    if (existingCategory) {
      return res.status(400).json({ success: false, message: "Category already exists" });
    }

    const updated = await Category.findByIdAndUpdate(
      categoryId,
      { categoryName, description },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    res.json({ success: true, message: "Category updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to update category" });
  }
};

// const deleteCategory = async (req, res) => {
//   try {
//     const categoryId = req.params.id;

//     await Category.findByIdAndUpdate(
//       { _id: categoryId },
//       { $set: { isBlocked: true } },
//       { new: true }
//     );

//     await Product.updateMany(
//       { category: categoryId },
//       { $set: { isDeleted:true } },
//       { new: true }
//     );

//     res.redirect("/admin/categoryList");
//   } catch (err) {
//     res.status(500).send(err);
//   }
// };

const toggleCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    category.isBlocked = !category.isBlocked;
    await category.save();

    await Product.updateMany(
      { category: category._id },
      { $set: { isDeleted: category.isBlocked } }
    );

    res.json({ success: true, isBlocked: category.isBlocked });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  addCategoryView,
  addCategory,
  categoryListView,
  editCategory,
  editCategoryView,
  toggleCategory,
};
