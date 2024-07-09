const mongoose = require("mongoose");

const newProduct = new mongoose.Schema({
    name:{
        type:String,
        require:true
    },
    description:{
        type:String,
        require:true
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'category', 
        require: true
    },
    brandName:{
        type:String,
        require:true
    },
    stock:{
        type:Number,
        require:true
    },
    price:{
        type:Number,
        require:true
    },
    tags:{
        type:String,
    },
    photos: [{
        filename: { type: String, required: true },
        originalname: { type: String },
        mimetype: { type: String, required: true }
      }],
    isDeleted:{
        type:Boolean,
        default:false
    },
    reviews: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Review'
      }],
    currentPrice: {
        type: Number,
        default: function() {
            return this.price;
        }
    },
    offer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Offer'
    },
},{timestamps:true});

const product = mongoose.model("products",newProduct);

module.exports = product ;