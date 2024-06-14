const mongoose = require("mongoose");

const newAddress = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', 
        required: true, 
    },
    address :[{
    name: {
        type: String,
        required: true
    },
    houseName: {
        type: String,
        required: true 
    },
    street: {
        type: String,
        required: true 
    },
    city: {
        type: String,
        required: true
    },
    district: {
        type: String,
        required: true 
    },
    state: {
        type: String,
        required: true 
    },
    pinCode: {
        type: Number,
        required: true 
    },
    isDefault: {
        type: Boolean
    }}]
}, {timestamps: true});

const Address = mongoose.model("Address", newAddress);

module.exports = Address;
