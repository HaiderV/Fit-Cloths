/**
 * Product API Service for Fit-Cloth
 * Connects frontend to backend endpoints (http://localhost:5000/api/products)
 */

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_API_URL || 'http://localhost:5001';

/**
 * Fetch products with optional filters, search, and sorting
 */
export async function getProducts(options = {}) {
    try {
        const queryParams = new URLSearchParams();

        if (options.category && options.category !== 'All') {
            queryParams.append('category', options.category);
        }
        if (options.target_audience && options.target_audience !== 'All') {
            queryParams.append('target_audience', options.target_audience);
        }
        if (options.search) {
            queryParams.append('search', options.search.trim());
        }
        if (options.trending) {
            queryParams.append('trending', 'true');
        }
        if (options.sort) {
            queryParams.append('sort', options.sort);
        }
        if (options.minPrice !== undefined) {
            queryParams.append('minPrice', options.minPrice);
        }
        if (options.maxPrice !== undefined) {
            queryParams.append('maxPrice', options.maxPrice);
        }
        if (options.limit) {
            queryParams.append('limit', options.limit);
        }

        const url = `${API_BASE_URL}/api/products?${queryParams.toString()}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
        const result = await res.json();
        return result.data || [];
    } catch (error) {
        console.error('Failed to get products:', error);
        return [];
    }
}

/**
 * Fetch a single product by ID or product_code
 */
export async function getProductById(id) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/products/${id}`);
        if (!res.ok) {
            if (res.status === 404) return null;
            throw new Error(`HTTP Error ${res.status}`);
        }
        const result = await res.json();
        return result.data || null;
    } catch (error) {
        console.error(`Failed to get product ${id}:`, error);
        return null;
    }
}

/**
 * Fetch all unique categories & audiences
 */
export async function getCategories() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/products/categories`);
        if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
        const result = await res.json();
        return result.categories || ['All'];
    } catch (error) {
        console.error('Failed to get categories:', error);
        return ['All'];
    }
}

// =========================================================================
// LOCAL BAG / CART HELPERS (Synchronized via 'cart_updated' custom events)
// =========================================================================

export function getLocalCart() {
    try {
        return JSON.parse(localStorage.getItem('fit_cloth_cart') || '[]');
    } catch {
        return [];
    }
}

export function addToLocalCart(product, size = 'CUSTOM', customMeasurements = null, fitProfile = null) {
    try {
        const cart = getLocalCart();
        const primaryImage = (Array.isArray(product.image_urls) && product.image_urls.length > 0)
            ? product.image_urls[0]
            : (product.image_url || '');

        const prodId = product.id ?? product.product_code;
        const profileId = fitProfile?.id || null;

        const idx = cart.findIndex(
            (item) =>
                (String(item.id) === String(prodId) ||
                 (product.product_code && item.product_code === product.product_code)) &&
                item.size === size &&
                (size !== 'CUSTOM' || item.fit_profile_id === profileId)
        );

        if (idx > -1) {
            cart[idx].quantity = (cart[idx].quantity || 1) + 1;
            if (customMeasurements && !cart[idx].custom_measurements) {
                cart[idx].custom_measurements = customMeasurements;
            }
            if (fitProfile?.tailorNotes) {
                cart[idx].tailor_notes = fitProfile.tailorNotes;
            }
        } else {
            cart.push({
                ...product,
                id: prodId,
                size,
                custom_measurements: size === 'CUSTOM' ? (customMeasurements || fitProfile?.measurements) : null,
                fit_profile_id: profileId,
                fit_profile_name: fitProfile?.name || (size === 'CUSTOM' ? 'Custom AI Fit' : null),
                tailor_notes: fitProfile?.tailorNotes || (fitProfile?.description || null),
                selected_image: primaryImage,
                quantity: 1,
            });
        }

        localStorage.setItem('fit_cloth_cart', JSON.stringify(cart));
        window.dispatchEvent(new Event('cart_updated'));
        return cart;
    } catch (e) {
        console.error('Failed to add to cart:', e);
        return [];
    }
}

export function removeFromLocalCart(productId, size = null, profileId = null) {
    try {
        let cart = getLocalCart();
        const strId = String(productId);
        const idx = cart.findIndex(
            (item) =>
                (String(item.id) === strId || item.product_code === productId) &&
                (!size || item.size === size) &&
                (!profileId || item.fit_profile_id === profileId)
        );

        if (idx > -1) {
            if ((cart[idx].quantity || 1) > 1) {
                cart[idx].quantity -= 1;
            } else {
                cart.splice(idx, 1);
            }
        }

        localStorage.setItem('fit_cloth_cart', JSON.stringify(cart));
        window.dispatchEvent(new Event('cart_updated'));
        return cart;
    } catch (e) {
        console.error('Failed to remove from cart:', e);
        return [];
    }
}

export function deleteFromLocalCart(productId, size = null, profileId = null) {
    try {
        let cart = getLocalCart();
        const strId = String(productId);
        cart = cart.filter(
            (item) =>
                !(
                    (String(item.id) === strId || item.product_code === productId) &&
                    (!size || item.size === size) &&
                    (!profileId || item.fit_profile_id === profileId)
                )
        );
        localStorage.setItem('fit_cloth_cart', JSON.stringify(cart));
        window.dispatchEvent(new Event('cart_updated'));
        return cart;
    } catch (e) {
        console.error('Failed to delete from cart:', e);
        return [];
    }
}

export function getProductCartQuantity(productId, size = null) {
    try {
        const cart = getLocalCart();
        const strId = String(productId);
        return cart
            .filter(
                (item) =>
                    (String(item.id) === strId || item.product_code === productId) &&
                    (!size || item.size === size)
            )
            .reduce((sum, item) => sum + (item.quantity || 1), 0);
    } catch {
        return 0;
    }
}
