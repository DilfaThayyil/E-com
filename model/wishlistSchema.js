const mongoose = require('mongoose')

const wishlistSchema = new mongoose.Schema({
    userid : {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true
    },
    products :[
        {
            productId :{
                type:mongoose.Schema.Types.ObjectId,
                ref: 'products',
                required: true
            }
        }
    ]
})

const Wishlist = mongoose.model("Wishlist",wishlistSchema)
module.exports = Wishlist