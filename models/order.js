const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const OrderSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [
        {
            productId: {
                type: Schema.Types.ObjectId,
                ref: 'products',
                required: true
            },
            quantity: {
                type: Number,
                required: true
            },
            status: {
                type: String,
                enum: ['Pending', 'Shipped', 'Delivered', 'Cancelled'],
                default: 'Pending'
            }
        }
    ],
    totalCost: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['online', 'cod', 'wallet'],
        required: true
    },
    couponCode: {
        type: String
    },
    paymentDetails: {
        type: Schema.Types.Mixed
    },
    priceDetails: {
        discountAmount: {
            type: Number,
            required: true
        },
        salesTax: {
            type: Number,
            required: true
        },
        deliveryCharge: {
            type: Number,
            required: true
        },
        subTotal: {
            type: Number,
            required: true
        }
    },
    deliveryAddress:{
        type: Schema.Types.Mixed,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Order = mongoose.model("Order", OrderSchema);
module.exports = Order;