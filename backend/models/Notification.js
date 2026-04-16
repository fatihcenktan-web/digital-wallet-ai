const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    type: { type: String, enum: ['alert', 'info'], required: true },
    text: { type: String, required: true },
    action: { type: String },
    time: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
