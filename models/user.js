const mongoose = require("mongoose");
const newUser = new mongoose.Schema({
    name:{
        type:String,
        require:true
    },
    email:{
        type:String,
        require:true
    },
    password:{
        type:String,
        require:true
    },
    gender:{
        type:String
    },
    photo: [{
        filename: { type: String, required: true },
        originalname: { type: String },
        mimetype: { type: String, required: true }
    }],
    isVerified:{
        type:Boolean,
        default:false
    },
    isAdmin:{
        type:Boolean,
        default:false
    },
    isBlocked:{
        type:Boolean,
        default:false
    }
},{timestamps:true});

const User = mongoose.model("User",newUser);

module.exports = User ;