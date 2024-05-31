const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    Name: {
        type: String,
        required: true
    },
    Description: {
        type: String,
        required: true
    },
    Status: {
        type: String,
        enum: ["active", "blocked"],
        default: "active"
    },
    offer:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'offer'
    }
});

const Category = mongoose.model("Category", categorySchema);

module.exports = Category;
