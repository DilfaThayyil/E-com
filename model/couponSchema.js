const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    code:{
        type:String,
        required:true
    },
    discountAmount:{
        type:Number,
        required:true
    },
    minAmount:{
        type:Number,
        required:true
    },
    description:{
        type:String,
        required:true
    },
    expiryDate:{
        type:Date,
        required:true
    },
    status:{
        type:Boolean,
        default:true
    },
    usedUser:[{
        userid:{
            type:mongoose.Types.ObjectId,
            ref:'User'
        },
        used:{
            type:Boolean,
            default:false
        }
    }]
        
});

const Coupon = mongoose.model("Coupon",couponSchema)
module.exports = Coupon