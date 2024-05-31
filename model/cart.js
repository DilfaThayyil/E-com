const mongoose = require('mongoose')

const cartSchema = new mongoose.Schema({
    userid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true
    },
    products: [
        {
            productId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'products',
                required: true
            },
            quantity:{
                type:Number,
                required:true
            },
            totalPrice:{
                type:Number,
                required:true
            }
        }
    ]            
})

const Cart = mongoose.model("Cart",cartSchema)
module.exports=Cart