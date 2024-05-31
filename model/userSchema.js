const mongoose = require('mongoose')
const user = new mongoose.Schema({
    Name:{
        type:String,
        required:true
    },
    Email:{
        type:String,
        required:true
    },
    PhoneNumber:{
        type:Number,
    
    },
    wallet:{
        type:Number,
        default:0
    },
    resetToken:{
        type:String,
        default:null
    },
    password:{
        type:String,
        required:true
    },
    isBlocked:{
        type:Boolean,
        default:false
    },
    ReferId:{
        type:String,
    },
    walletHistory: [{
        amount: {
            type: Number,
        },
        description: {
            type: String,
        },
        date: {
            type: Date,
            default: Date.now()
        },
        status: {
            type: String,
        }
    }],
    Addresses:[{
        name:{
            type:String
        },
        phone:{
            type:String
        },
        email:{
            type:String
        },
        address:{
            type:String
        },
        pincode:{
            type:String
        },
        state:{
            type:String
        },
        city:{
            type:String
        }

    }]
})


const User = mongoose.model('User', user);
module.exports = User;
