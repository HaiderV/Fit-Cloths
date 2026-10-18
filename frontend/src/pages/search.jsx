import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    getLocalCart,
    addToLocalCart,
    removeFromLocalCart,
} from '../services/productService';

// Safely access Vite environment variables
const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_API_URL || 'http://localhost:5001';

const formatCategoryName = (cat) => {
    if (!cat) return 'BESPOKE';
    return cat.replace(/_/g, ' ').toUpperCase();
};

const formatPriceINR = (val) => {
    const num = Number(val) || 0;
    return `₹${num.toLocaleString('en-IN')}`;
};

const SearchPage = ({ onSelectProduct, onAddToCart }) => {
    const navigate = useNavigate();

    const [products, setProducts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedAudience, setSelectedAudience] = useState('All');
    const [sortBy, setSortBy] = useState('default');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [toastMessage, setToastMessage] = useState(null);
    const [cart, setCart] = useState(getLocalCart);

    // Keep cart state in sync with localStorage across the application
    useEffect(() => {
        const syncCart = () => setCart(getLocalCart());
        window.addEventListener('cart_updated', syncCart);
        window.addEventListener('storage', syncCart);
        return () => {
            window.removeEventListener('cart_updated', syncCart);
            window.removeEventListener('storage', syncCart);
        };
    }, []);

    // Fetch all products from the backend database
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                setLoading(true);
                setError(null);
                const response = await fetch(`${API_BASE_URL}/api/products`);
                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status}`);
                }
                const result = await response.json();

                if (result.success && Array.isArray(result.data)) {
                    setProducts(result.data);
                } else {
                    setError('Failed to retrieve products from database');
                }
            } catch (err) {
                console.error('Fetch error:', err);
                setError('Could not connect to backend server. Please verify backend is running on port 5000.');
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, []);

    // Unique Categories extracted from products
    const categories = useMemo(() => {
        const set = new Set(products.map((p) => p.category).filter(Boolean));
        return ['All', ...Array.from(set).sort()];
    }, [products]);

    // Unique Target Audiences
    const audiences = useMemo(() => {
        const set = new Set(products.map((p) => p.target_audience).filter(Boolean));
        return ['All', ...Array.from(set).sort()];
    }, [products]);

    // Handle Product Selection (Card Click)
    const handleProductClick = (productId) => {
        if (onSelectProduct) {
            onSelectProduct(productId);
        } else {
            navigate(`/cloth?id=${productId}`);
        }
    };

    // Calculate total quantity for a given product in the current bag
    const getProductQuantity = (product) => {
        const prodId = String(product.id ?? product.product_code);
        return cart
            .filter(
                (item) =>
                    String(item.id) === prodId ||
                    (product.product_code && item.product_code === product.product_code)
            )
            .reduce((sum, item) => sum + (item.quantity || 1), 0);
    };

    // Handle Add to Bag with LocalStorage persistence & Toast
    const handleAddToCart = (product) => {
        if (onAddToCart) {
            onAddToCart(product);
        } else {
            addToLocalCart(product, 'CUSTOM');
        }

        // Show feedback toast
        setToastMessage({
            type: 'add',
            text: `ADDED TO BAG: ${product.name}`,
        });
        setTimeout(() => {
            setToastMessage((current) => (current?.text?.includes(product.name) ? null : current));
        }, 2500);
    };

    // Handle Remove from Bag with LocalStorage persistence & Toast
    const handleRemoveFromCart = (product) => {
        const prodId = product.id ?? product.product_code;
        removeFromLocalCart(prodId);

        // Show feedback toast
        setToastMessage({
            type: 'remove',
            text: `REMOVED FROM BAG: ${product.name}`,
        });
        setTimeout(() => {
            setToastMessage((current) => (current?.text?.includes(product.name) ? null : current));
        }, 2500);
    };

    // Filter by Category, Audience, and Regex / Keyword Search
    const filteredProducts = useMemo(() => {
        return products.filter((product) => {
            // Category check
            if (selectedCategory !== 'All' && product.category?.toLowerCase() !== selectedCategory.toLowerCase()) {
                return false;
            }

            // Audience check
            if (selectedAudience !== 'All' && product.target_audience?.toLowerCase() !== selectedAudience.toLowerCase()) {
                return false;
            }

            // Regex / Keyword Search check
            if (!searchQuery.trim()) return true;

            try {
                const regex = new RegExp(searchQuery.trim(), 'i');
                const colorsStr = Array.isArray(product.colors) ? product.colors.join(' ') : '';
                const tagsStr = Array.isArray(product.style_tags) ? product.style_tags.join(' ') : '';
                const occasionStr = Array.isArray(product.occasion) ? product.occasion.join(' ') : '';

                return (
                    regex.test(product.name || '') ||
                    regex.test(product.product_code || '') ||
                    regex.test(product.description || '') ||
                    regex.test(product.category || '') ||
                    regex.test(product.fit_type || '') ||
                    regex.test(colorsStr) ||
                    regex.test(tagsStr) ||
                    regex.test(occasionStr)
                );
            } catch {
                // Safe fallback if user is in middle of typing invalid regex
                const query = searchQuery.toLowerCase();
                return (
                    product.name?.toLowerCase().includes(query) ||
                    product.product_code?.toLowerCase().includes(query) ||
                    product.description?.toLowerCase().includes(query) ||
                    product.category?.toLowerCase().includes(query)
                );
            }
        });
    }, [products, selectedCategory, selectedAudience, searchQuery]);

    // Sorted products
    const sortedProducts = useMemo(() => {
        const copy = [...filteredProducts];
        if (sortBy === 'price_asc') {
            return copy.sort((a, b) => Number(a.price_inr || a.price) - Number(b.price_inr || b.price));
        }
        if (sortBy === 'price_desc') {
            return copy.sort((a, b) => Number(b.price_inr || b.price) - Number(a.price_inr || a.price));
        }
        if (sortBy === 'rating') {
            return copy.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
        }
        return copy;
    }, [filteredProducts, sortBy]);

    const isSearchingOrFiltering = Boolean(
        searchQuery.trim() ||
        selectedCategory !== 'All' ||
        selectedAudience !== 'All' ||
        sortBy !== 'default'
    );

    return (
        <div className="relative w-full min-h-screen bg-[#f7f6f0] text-black font-sans editorial-grid px-5 sm:px-8 md:px-12 py-10 pb-24">

            {/* Floating Toast Notification */}
            {toastMessage && (
                <div
                    className={`fixed bottom-6 right-6 z-50 px-5 py-3 border font-mono text-xs uppercase tracking-wider flex items-center gap-3 animate-bounce shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] ${
                        toastMessage.type === 'remove'
                            ? 'bg-neutral-900 border-amber-500 text-amber-300'
                            : 'bg-black border-white/20 text-white'
                    }`}
                >
                    <span
                        className={`w-2 h-2 rounded-full ${
                            toastMessage.type === 'remove' ? 'bg-amber-400' : 'bg-emerald-400'
                        }`}
                    ></span>
                    <span>{toastMessage.text}</span>
                </div>
            )}

            {/* Technical Crosshairs */}
            <div className="absolute top-6 left-6 text-black/30 text-xs font-mono select-none">+</div>
            <div className="absolute top-6 right-6 text-black/30 text-xs font-mono select-none">+</div>

            <div className="max-w-7xl mx-auto w-full">

                {/* Page Header */}
                <div className="mb-8 pb-6 border-b border-black/15 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-[11px] font-mono font-bold tracking-widest uppercase text-red-600">
                                [ BESPOKE CATALOG ARCHIVE // TAILORED DATASET ]
                            </span>
                        </div>
                        <h1 className="text-4xl sm:text-6xl font-black tracking-tighter uppercase font-sans">
                            EXPLORE CLOTHES.
                        </h1>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs font-mono uppercase text-black/60">
                        <span>CATALOG: [{products.length}]</span>
                        <span>•</span>
                        <span>MATCHING: [{sortedProducts.length}]</span>
                        {cart.length > 0 && (
                            <>
                                <span>•</span>
                                <button
                                    onClick={() => navigate('/cart')}
                                    className="bg-black text-white px-2.5 py-1 hover:bg-neutral-800 cursor-pointer flex items-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]"
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                    IN BAG: [{cart.reduce((sum, item) => sum + (item.quantity || 1), 0)}]
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Search Bar with Regex Support */}
                <div className="mb-6 relative">
                    <div className="relative flex items-center">
                        <span className="absolute left-5 font-mono text-xs uppercase tracking-widest text-black/40 select-none">
                            SEARCH://
                        </span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by name, code, fabric, occasion (e.g. 'saree', 'sherwani', 'navy', 'blazer')..."
                            className="w-full bg-white border-2 border-black py-4 sm:py-5 pl-24 pr-24 text-xs sm:text-sm font-medium tracking-wide uppercase placeholder:text-black/30 focus:outline-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-4 text-xs font-mono uppercase bg-black text-white px-3 py-1.5 hover:bg-neutral-800 cursor-pointer transition-colors"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                    <div className="mt-2 flex flex-wrap justify-between items-center text-[10px] font-mono uppercase text-black/50 gap-2">
                        <span>[ REGEX & KEYWORD SEARCH ENABLED ]</span>
                        <span>MATCHING ITEMS: {sortedProducts.length}</span>
                    </div>
                </div>

                {/* Filter Controls Row */}
                <div className="mb-10 space-y-4 pb-6 border-b border-black/10">

                    {/* Category Filter Pills */}
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 mr-1 select-none">
                            CATEGORY:
                        </span>
                        {categories.map((cat) => {
                            const isActive = selectedCategory.toLowerCase() === cat.toLowerCase();
                            return (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider transition-all cursor-pointer ${
                                        isActive
                                            ? 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                                            : 'bg-white text-black border border-black/30 hover:border-black'
                                    }`}
                                >
                                    [ {formatCategoryName(cat)} ]
                                </button>
                            );
                        })}
                    </div>

                    {/* Audience & Sort Controls */}
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        {/* Audience Filter Pills */}
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 mr-1 select-none">
                                AUDIENCE:
                            </span>
                            {audiences.map((aud) => {
                                const isActive = selectedAudience.toLowerCase() === aud.toLowerCase();
                                return (
                                    <button
                                        key={aud}
                                        onClick={() => setSelectedAudience(aud)}
                                        className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider transition-all cursor-pointer ${
                                            isActive
                                                ? 'bg-red-600 text-white'
                                                : 'bg-neutral-100 text-neutral-700 border border-black/20 hover:border-black'
                                        }`}
                                    >
                                        {aud.toUpperCase()}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Sort Dropdown */}
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 select-none">
                                SORT:
                            </span>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="bg-white border border-black px-3 py-1.5 text-xs font-mono uppercase tracking-wider focus:outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
                            >
                                <option value="default">Default</option>
                                <option value="price_asc">Price: Low to High</option>
                                <option value="price_desc">Price: High to Low</option>
                                <option value="rating">Top Rated (★)</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Loading / Error States */}
                {loading && (
                    <div className="py-24 text-center font-mono text-sm uppercase tracking-widest text-black/60 animate-pulse">
                        [ CONNECTING TO FIT CLOTH INVENTORY... ]
                    </div>
                )}

                {error && (
                    <div className="p-6 bg-red-50 border-2 border-red-500 text-red-700 font-mono text-xs uppercase mb-12 shadow-[3px_3px_0px_0px_rgba(239,68,68,1)] flex flex-col gap-2">
                        <span className="font-bold">[ ERROR ]: {error}</span>
                        <span className="text-[11px] text-red-600">Tip: Check if your backend server is running in terminal with npm run dev.</span>
                    </div>
                )}

                {/* Main Product Grid */}
                {!loading && !error && (
                    <div>
                        <div className="flex items-center justify-between mb-6 pb-2 border-b border-black">
                            <h2 className="text-xl font-black uppercase tracking-tight">
                                {isSearchingOrFiltering
                                    ? `Filtered Garments (${sortedProducts.length})`
                                    : `All Bespoke Garments (${products.length})`}
                            </h2>
                            {isSearchingOrFiltering && (
                                <button
                                    onClick={() => {
                                        setSearchQuery('');
                                        setSelectedCategory('All');
                                        setSelectedAudience('All');
                                        setSortBy('default');
                                    }}
                                    className="text-xs font-mono uppercase underline hover:opacity-60 cursor-pointer"
                                >
                                    Reset Filters
                                </button>
                            )}
                        </div>

                        {sortedProducts.length === 0 ? (
                            <div className="py-16 text-center font-mono text-xs uppercase text-black/50 border border-dashed border-black/30">
                                No matching clothes found for your query. Try resetting filters.
                            </div>
                        ) : (
                            <ProductGrid
                                products={sortedProducts}
                                onSelectProduct={handleProductClick}
                                onAddToCart={handleAddToCart}
                                onRemoveFromCart={handleRemoveFromCart}
                                getProductQuantity={getProductQuantity}
                            />
                        )}
                    </div>
                )}

            </div>
        </div>
    );
};

// Reusable Product Grid Component formatted for the dataset
const ProductGrid = ({
    products,
    onSelectProduct,
    onAddToCart,
    onRemoveFromCart,
    getProductQuantity,
}) => {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((product) => {
                const img = (Array.isArray(product.image_urls) && product.image_urls.length > 0)
                    ? product.image_urls[0]
                    : (product.image_url || 'https://images.unsplash.com/photo-1592878904946-b3cd8ae243d0?auto=format&fit=crop&w=1200&q=85');

                const priceFormatted = formatPriceINR(product.price_inr || product.price);
                const qty = getProductQuantity ? getProductQuantity(product) : 0;
                const isInBag = qty > 0;

                return (
                    <div
                        key={product.id || product.product_code}
                        className={`bg-white border rounded-sm overflow-hidden group flex flex-col justify-between transition-all duration-200 ${
                            isInBag
                                ? 'border-emerald-600 ring-2 ring-emerald-500 shadow-[4px_4px_0px_0px_rgba(16,185,129,0.7)]'
                                : 'border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]'
                        }`}
                    >
                        {/* Clickable Image Section */}
                        <div
                            onClick={() => onSelectProduct && onSelectProduct(product.id || product.product_code)}
                            className="relative aspect-[4/5] bg-neutral-200 overflow-hidden cursor-pointer"
                        >
                            <img
                                src={img}
                                alt={product.name}
                                loading="lazy"
                                onError={(e) => {
                                    e.target.src = 'https://images.unsplash.com/photo-1592878904946-b3cd8ae243d0?auto=format&fit=crop&w=1200&q=85';
                                }}
                                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                            />

                            {/* Top Left Badges */}
                            <div className="absolute top-3 left-3 flex flex-col gap-1 items-start z-10">
                                {product.product_code && (
                                    <span className="bg-black text-white text-[9px] font-mono uppercase tracking-widest px-2 py-0.5">
                                        {product.product_code}
                                    </span>
                                )}
                                {product.target_audience && (
                                    <span className="bg-white/95 backdrop-blur-sm text-black border border-black/20 text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5">
                                        {product.target_audience}
                                    </span>
                                )}
                            </div>

                            {/* Top Right: Prominent IN BAG Badge when item is added */}
                            {isInBag && (
                                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-emerald-500 text-black border border-black font-mono font-black text-[10px] uppercase px-2.5 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] z-10 animate-fadeIn">
                                    <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse"></span>
                                    IN BAG: [{qty}]
                                </div>
                            )}

                            {/* Rating Stamp */}
                            <span className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm text-black text-[10px] font-mono px-2 py-0.5 border border-black/20 font-bold">
                                ★ {product.rating || '4.9'}
                            </span>
                        </div>

                        {/* Product Info */}
                        <div className="p-5 flex flex-col justify-between flex-grow">
                            <div
                                onClick={() => onSelectProduct && onSelectProduct(product.id || product.product_code)}
                                className="cursor-pointer"
                            >
                                {/* Category & Fit Type */}
                                <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-1 flex items-center justify-between">
                                    <span>{formatCategoryName(product.category)}</span>
                                    <span className="text-black/40">• {product.fit_type || 'CUSTOM'}</span>
                                </div>

                                {/* Title */}
                                <h3 className="font-bold text-sm uppercase tracking-tight line-clamp-1 group-hover:underline text-black">
                                    {product.name}
                                </h3>

                                {/* Description */}
                                <p className="text-xs text-black/70 mt-1.5 line-clamp-2 font-medium">
                                    {product.description}
                                </p>

                                {/* Tags / Colors */}
                                {Array.isArray(product.colors) && product.colors.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-1">
                                        {product.colors.slice(0, 3).map((c, i) => (
                                            <span
                                                key={i}
                                                className="text-[9px] font-mono uppercase px-1.5 py-0.5 bg-neutral-100 border border-neutral-300 text-neutral-600"
                                            >
                                                {c}
                                            </span>
                                        ))}
                                        {product.colors.length > 3 && (
                                            <span className="text-[9px] font-mono text-neutral-400 self-center">
                                                +{product.colors.length - 3}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Price & Add to Bag / Interactive Quantity Controls */}
                            <div className="mt-5 pt-4 border-t border-black/10 flex items-center justify-between gap-3">
                                <div>
                                    <span className="block text-[9px] font-mono uppercase tracking-wider text-neutral-400">
                                        BESPOKE FIT
                                    </span>
                                    <span className="font-mono font-black text-base text-black">
                                        {priceFormatted}
                                    </span>
                                </div>

                                {!isInBag ? (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (onAddToCart) onAddToCart(product);
                                        }}
                                        className="px-3.5 py-2 bg-black text-white text-[11px] font-mono uppercase tracking-wider hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] font-bold flex items-center gap-1"
                                    >
                                        + ADD
                                    </button>
                                ) : (
                                    <div
                                        onClick={(e) => e.stopPropagation()}
                                        className="flex items-center border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                    >
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (onRemoveFromCart) onRemoveFromCart(product);
                                            }}
                                            title="Remove 1 unit from bag"
                                            className="w-8 h-8 flex items-center justify-center bg-neutral-100 hover:bg-red-500 hover:text-white text-black font-mono font-black text-base cursor-pointer border-r-2 border-black active:bg-neutral-300 transition-colors"
                                        >
                                            −
                                        </button>
                                        <span className="min-w-[32px] px-1 text-center font-mono font-black text-xs text-black select-none">
                                            {qty}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (onAddToCart) onAddToCart(product);
                                            }}
                                            title="Add 1 more unit to bag"
                                            className="w-8 h-8 flex items-center justify-center bg-black hover:bg-neutral-800 text-white font-mono font-black text-base cursor-pointer border-l-2 border-black active:bg-neutral-900 transition-colors"
                                        >
                                            +
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default SearchPage;