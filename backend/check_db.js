const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function test() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const user = await User.findOne({ username: 'fatih' });
        console.log("User fatih:", user);
        if (user) {
            const match = await bcrypt.compare('123456', user.password);
            console.log("Password 123456 matched:", match);
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
test();
