const mongoose = require('mongoose');

const bankSchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: { type: String, required: true },
    balance: { type: Number, required: true },
    iconClass: { type: String, required: true },
    iconName: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Bank', bankSchema);
