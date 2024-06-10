const mongoose = require('mongoose')

const order = new mongoose.Schema({
    userid:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    products:[{
            products:{
                type: mongoose.Schema.Types.ObjectId,
                ref:'products',
                required: true
            },
            Status: {
                type: String,
                default: 'pending',
                enum: ['placed', 'shipped', 'delivered', 'request return', 'returned', 'request cancellation', 'cancelled','pending']
            },
            quantity: {
                type: Number,
    
            },
            total: {
                type: Number,
    
            },
            reason:{
                type: String
            },
            
            }],
    paymentMode:{
        type:String
    },
    paymentStatus:{
        type:String,
        default:'Pending'
    },
    total: {
        type: Number
    },
    date: {
        type: Date
    },
    address: {
        type: Object
    },

});
    

const Order = mongoose.model("Order",order)
module.exports=Order