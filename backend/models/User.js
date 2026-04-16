const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    balance: { type: Number, required: true, default: 0 },
    isPhysicalCardFrozen: { type: Boolean, default: false },
    virtualCardLimit: { type: Number, default: 5000 },
    virtualCards: [{
        cardNumber: String,
        cvv: String,
        expiry: String,
        createdAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
