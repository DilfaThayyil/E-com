const mongoose = require('mongoose');

const userOtpVerificationSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    otp: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: { expires: '120s' }  
    }
});

userOtpVerificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 120 });
const userOtpVerification = mongoose.model('userOtpVerification', userOtpVerificationSchema);

module.exports = userOtpVerification;
