const Category = require("../models/category");

const categoryListView = async (req, res) => {
  try {
    console.log("view category");
    const categoryList = await Category.find({ isBlocked: false });

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
      console.log("incomplete details");
    }

    const existingCategory = await Category.findOne({
      categoryName: categoryName,
    });

    if (existingCategory) {
      console.log("the category already exists");
      res.render("admin/addCategory", {
        message: "the category already exists",
      });
    } else {
      const newCategory = new Category({
        categoryName,
        description,
        isBlocked: false,
      });

      await Category.create(newCategory);
      res.redirect("/admin/categoryList");
    }
  } catch (error) {
    console.log(error);
    res.status(500).send("internal server error");
  }
};

const editCategoryView = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const categoryList = await Category.findById(categoryId);

    res.render("admin/editCategory", { categoryList, message:'' });
  } catch (error) {
    console.log(error);
    res.status(500).send("internal server error");
  }
};

const editCategory = async (req, res) => {
  try { 
    console.log("updating category");
    const categoryId = req.params.id;
    const { categoryName, description } = req.body;

    console.log("updating category");
    await Category.findByIdAndUpdate(categoryId, {
      categoryName,
      description,
    });

    res.redirect("/admin/categoryList");
  } catch (err) {
    res.status(500).send(err);
  }
};

const deleteCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;

    const categoryData = await Category.findById(categoryId);
    await Category.findByIdAndUpdate(
      { _id: categoryId },
      { $set: { isBlocked: !categoryData.isBlocked } },
      { new: true }
    );

    if (!categoryData) {
      return res.status(404).json({ error: "category not found" });
    }

    res.redirect("/admin/categoryList");
  } catch (err) {
    res.status(500).send(err);
  }
};

module.exports = {
  addCategoryView,
  addCategory,
  categoryListView,
  editCategory,
  deleteCategory,
  editCategoryView,
};
