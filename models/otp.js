const mongoose = require("mongoose");
const otp = new mongoose.Schema({
    email:{
        type:String,
        require:true
    },
    otp:{
        type:Number,
        require:true
    },
    expiry:{
        type:Date
    }
},{timestamps:true});

const otpEntry = mongoose.model("otp",otp);

module.exports = otpEntry ;