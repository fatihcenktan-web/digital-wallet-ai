const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const transactions = [
    { amount: 50, category: 'Food', type: 'expense' },
    { amount: 100, category: 'Shopping', type: 'expense' }
];
const balance = 5000;
const message = "En çok nereye harcadım?";

async function test() {
    try {
        console.log("Testing AI Logic...");
        const lowerMsg = message.toLowerCase();

        // Local engine logic
        let totalExpense = 0, totalIncome = 0;
        let categories = {};
        transactions.forEach(t => {
            if (t.type === 'expense') {
                totalExpense += t.amount;
                categories[t.category] = (categories[t.category] || 0) + t.amount;
            } else {
                totalIncome += t.amount;
            }
        });

        let reply = "Ben NexBot AI. Fallback reply.";
        if (lowerMsg.includes('harca') || lowerMsg.includes('masraf') || lowerMsg.includes('gider')) {
            let topCat = Object.keys(categories).sort((a, b) => categories[b] - categories[a])[0];
            reply = `Harca analizi: Toplam ${totalExpense}. En çok ${topCat}`;
        }
        console.log("Local Reply:", reply);
    } catch (e) {
        console.error("Test failed:", e);
    }
}

test();
