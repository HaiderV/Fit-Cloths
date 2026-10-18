const fs = require('fs');
const path = require('path');
const supabase = require('./config/supabaseClient');

async function syncFallback() {
    try {
        const { data, error } = await supabase.from('products').select('*');
        if (error) {
            console.error('Supabase query error:', error);
            return;
        }
        if (data && data.length > 0) {
            const dataDir = path.join(__dirname, 'data');
            if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
            const filePath = path.join(dataDir, 'products.json');
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
            console.log(`Successfully synced ${data.length} products to backend/data/products.json!`);
        }
    } catch (err) {
        console.error('Sync error:', err);
    }
}

syncFallback();
