const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const supabase = require('../config/supabaseClient');

// Load fallback dataset extracted from dataset.ipynb / Supabase backup
let localProducts = [];
try {
    const dataPath = path.join(__dirname, '../data/products.json');
    if (fs.existsSync(dataPath)) {
        localProducts = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    }
} catch (e) {
    console.warn('Could not load local products backup:', e.message);
}

/**
 * Normalizes product properties so both Supabase and Frontend formats are 100% compatible.
 */
function normalizeProduct(p) {
    if (!p) return null;
    const price = p.price_inr !== undefined && p.price_inr !== null ? p.price_inr : (p.price || 0);
    const primaryImage = (Array.isArray(p.image_urls) && p.image_urls.length > 0)
        ? p.image_urls[0]
        : (p.image_url || 'https://images.unsplash.com/photo-1592878904946-b3cd8ae243d0?auto=format&fit=crop&w=1200&q=85');

    return {
        id: p.id || p.product_code,
        product_code: p.product_code || `FC-${p.id}`,
        name: p.name || 'Bespoke Garment',
        category: p.category || 'formal_set',
        target_audience: p.target_audience || 'unisex',
        description: p.description || '',
        brand: p.brand || 'Fit Cloths',
        colors: Array.isArray(p.colors) ? p.colors : [],
        fabric_composition: p.fabric_composition || 'Custom blended suiting fabric',
        fit_type: p.fit_type || 'custom tailored',
        occasion: Array.isArray(p.occasion) ? p.occasion : [],
        style_tags: Array.isArray(p.style_tags) ? p.style_tags : [],
        price: price,
        price_inr: price,
        image_url: primaryImage,
        image_urls: Array.isArray(p.image_urls) ? p.image_urls : [primaryImage],
        rating: p.rating || 4.9,
        is_trending: p.is_trending !== undefined ? p.is_trending : true,
        customization_options: p.customization_options || {},
        tailoring_details: p.tailoring_details || 'Made to order based on precise proportion measurements.',
    };
}

/**
 * Filter local products if Supabase encounters network timeout / offline mode
 */
function filterLocalProducts({ category, target_audience, search, q, minPrice, maxPrice, sort, limit, offset }) {
    let result = [...localProducts];

    if (category && category.toLowerCase() !== 'all') {
        result = result.filter(p => p.category?.toLowerCase() === category.toLowerCase());
    }

    if (target_audience && target_audience.toLowerCase() !== 'all') {
        result = result.filter(p => p.target_audience?.toLowerCase() === target_audience.toLowerCase());
    }

    const term = (search || q || '').trim().toLowerCase();
    if (term) {
        result = result.filter(p => {
            return (
                p.name?.toLowerCase().includes(term) ||
                p.description?.toLowerCase().includes(term) ||
                p.product_code?.toLowerCase().includes(term) ||
                p.category?.toLowerCase().includes(term) ||
                (Array.isArray(p.colors) && p.colors.some(c => c.toLowerCase().includes(term))) ||
                (Array.isArray(p.style_tags) && p.style_tags.some(t => t.toLowerCase().includes(term)))
            );
        });
    }

    if (minPrice) {
        result = result.filter(p => (p.price_inr || p.price || 0) >= Number(minPrice));
    }
    if (maxPrice) {
        result = result.filter(p => (p.price_inr || p.price || 0) <= Number(maxPrice));
    }

    if (sort === 'price_asc') {
        result.sort((a, b) => (a.price_inr || a.price || 0) - (b.price_inr || b.price || 0));
    } else if (sort === 'price_desc') {
        result.sort((a, b) => (b.price_inr || b.price || 0) - (a.price_inr || a.price || 0));
    }

    if (limit) {
        const off = offset ? parseInt(offset, 10) : 0;
        result = result.slice(off, off + parseInt(limit, 10));
    }

    return result;
}

// =========================================================================
// 1. GET ALL PRODUCTS (Supabase with Automatic Offline / Network Fallback)
// =========================================================================
router.get('/', async (req, res) => {
    const { category, target_audience, search, q, minPrice, maxPrice, sort, limit, offset } = req.query;
    let productsData = null;
    let dataSource = 'supabase';

    try {
        let query = supabase.from('products').select('*');

        if (category && category.toLowerCase() !== 'all') {
            query = query.ilike('category', category);
        }

        if (target_audience && target_audience.toLowerCase() !== 'all') {
            query = query.ilike('target_audience', target_audience);
        }

        const searchTerm = search || q;
        if (searchTerm) {
            query = query.or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,product_code.ilike.%${searchTerm}%,fit_type.ilike.%${searchTerm}%`);
        }

        if (minPrice) query = query.gte('price_inr', Number(minPrice));
        if (maxPrice) query = query.lte('price_inr', Number(maxPrice));

        if (sort === 'price_asc') {
            query = query.order('price_inr', { ascending: true });
        } else if (sort === 'price_desc') {
            query = query.order('price_inr', { ascending: false });
        } else {
            query = query.order('created_at', { ascending: false });
        }

        if (limit) {
            const numLimit = parseInt(limit, 10);
            const numOffset = offset ? parseInt(offset, 10) : 0;
            query = query.range(numOffset, numOffset + numLimit - 1);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (data && data.length > 0) {
            productsData = data;
        }
    } catch (err) {
        console.warn('⚠️ Supabase unavailable or timeout, serving fallback dataset:', err.message);
        dataSource = 'local_dataset';
    }

    // Fallback if Supabase errored or returned no rows
    if (!productsData || productsData.length === 0) {
        productsData = filterLocalProducts({ category, target_audience, search, q, minPrice, maxPrice, sort, limit, offset });
        dataSource = 'local_dataset';
    }

    const normalized = productsData.map(normalizeProduct);

    res.status(200).json({
        success: true,
        source: dataSource,
        count: normalized.length,
        data: normalized,
    });
});

// =========================================================================
// 2. GET UNIQUE CATEGORIES & AUDIENCES
// =========================================================================
router.get('/categories', async (req, res) => {
    let categories = [];
    let audiences = [];

    try {
        const { data, error } = await supabase.from('products').select('category, target_audience');
        if (error) throw error;
        if (data && data.length > 0) {
            categories = ['All', ...Array.from(new Set(data.map(i => i.category).filter(Boolean))).sort()];
            audiences = ['All', ...Array.from(new Set(data.map(i => i.target_audience).filter(Boolean))).sort()];
        }
    } catch (e) {
        // Fallback from local data
        categories = ['All', ...Array.from(new Set(localProducts.map(i => i.category).filter(Boolean))).sort()];
        audiences = ['All', ...Array.from(new Set(localProducts.map(i => i.target_audience).filter(Boolean))).sort()];
    }

    if (categories.length === 0) {
        categories = ['All', 'formal_set', 'indian_traditional_wear'];
        audiences = ['All', 'men', 'women'];
    }

    res.status(200).json({
        success: true,
        categories,
        audiences,
    });
});

// =========================================================================
// 3. GET SINGLE PRODUCT BY ID OR PRODUCT CODE
// =========================================================================
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    let found = null;

    try {
        let query = supabase.from('products').select('*');
        if (!isNaN(id)) {
            query = query.eq('id', Number(id));
        } else {
            query = query.eq('product_code', id);
        }
        const { data, error } = await query.single();
        if (!error && data) found = data;
    } catch (e) {
        console.warn('Supabase fetch failed for product, checking local data:', e.message);
    }

    // Fallback search in local cache
    if (!found) {
        found = localProducts.find(p => String(p.id) === String(id) || p.product_code === id);
    }

    if (!found) {
        return res.status(404).json({
            success: false,
            message: `Product '${id}' not found.`,
        });
    }

    res.status(200).json({
        success: true,
        data: normalizeProduct(found),
    });
});

module.exports = router;