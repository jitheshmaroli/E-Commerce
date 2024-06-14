const mongoose = require("mongoose");
const newCategory = new mongoose.Schema({
    categoryName:{
        type:String,
        require:true
    },
    description:{
        type:String,
        require:true
    },
    isBlocked:{
        type:Boolean
    }
},{timestamps:true});

const category = mongoose.model("category",newCategory);

module.exports = category ;