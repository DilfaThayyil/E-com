const mongoose = require('mongoose')

const offerSchema = new mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    startDate:{
        type:Date,
        required:true
    },
    endDate:{
        type:Date,
        required:true
    },
    percentage:{
        type:Number,
        required:true
    }
})

const offer = mongoose.model("offer",offerSchema)
module.exports = offer