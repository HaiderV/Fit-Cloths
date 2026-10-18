import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
    getLocalCart,
    addToLocalCart,
    removeFromLocalCart,
    deleteFromLocalCart,
} from '../services/productService';

// Safely access Vite environment variables
const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_API_URL || 'http://localhost:5001';

const formatCategoryName = (cat) => {
    if (!cat) return 'BESPOKE GARMENT';
    return cat.replace(/_/g, ' ').toUpperCase();
};

const formatPriceINR = (val) => {
    const num = Number(val) || 0;
    return `₹${num.toLocaleString('en-IN')}`;
};

const ProductDetailPage = () => {
    const { id: paramId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    // Supports both /cloth/:id and /cloth?id=...
    const id = paramId || searchParams.get('id');

    const [product, setProduct] = useState(null);
    const [selectedImageIdx, setSelectedImageIdx] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedSize, setSelectedSize] = useState('CUSTOM');
    const [feedbackToast, setFeedbackToast] = useState(null);
    const [cart, setCart] = useState(getLocalCart);
    // Saved AI Fit Profiles Management
    const loadProfiles = () => {
        try {
            const list = JSON.parse(localStorage.getItem('fit_cloth_profiles') || '[]');
            if (Array.isArray(list) && list.length > 0) return list;
            const legacy = JSON.parse(localStorage.getItem('fit_cloth_measurements') || 'null');
            if (legacy?.measurements) {
                return [{
                    id: legacy.id || 'fit_default',
                    name: legacy.name || 'My Primary Fit',
                    tailorNotes: legacy.tailorNotes || legacy.description || '',
                    gender: legacy.gender || 'male',
                    height: legacy.height || 178,
                    unit: legacy.unit || 'CM',
                    fitPreference: legacy.fitPreference || 'TAILORED',
                    measurements: legacy.measurements,
                }];
            }
            return [];
        } catch {
            return [];
        }
    };

    const [profiles, setProfiles] = useState(loadProfiles);
    const [selectedProfileId, setSelectedProfileId] = useState(() => {
        const list = loadProfiles();
        try {
            const activeStored = JSON.parse(localStorage.getItem('fit_cloth_measurements') || 'null');
            if (activeStored?.id && list.some(p => p.id === activeStored.id)) {
                return activeStored.id;
            }
        } catch {}
        return list[0]?.id || null;
    });

    const activeProfile = useMemo(() => {
        if (!profiles.length) return null;
        return profiles.find((p) => p.id === selectedProfileId) || profiles[0];
    }, [profiles, selectedProfileId]);

    // Direct instructions / description note for this bespoke fit
    const [tailorNotes, setTailorNotes] = useState(() => activeProfile?.tailorNotes || '');

    // Keep tailorNotes updated if active profile changes
    useEffect(() => {
        if (activeProfile) {
            setTailorNotes(activeProfile.tailorNotes || '');
        }
    }, [selectedProfileId]);

    // Handle tailor note changes & sync to localStorage
    const handleTailorNotesChange = (val) => {
        setTailorNotes(val);
        if (activeProfile) {
            const updated = profiles.map(p => p.id === activeProfile.id ? { ...p, tailorNotes: val } : p);
            setProfiles(updated);
            try {
                localStorage.setItem('fit_cloth_profiles', JSON.stringify(updated));
                const currentFit = { ...activeProfile, tailorNotes: val };
                localStorage.setItem('fit_cloth_measurements', JSON.stringify(currentFit));
            } catch (e) {
                console.warn('Failed to sync tailor note to localStorage:', e);
            }
        }
    };

    // Keep cart and fit profiles in sync with localStorage and other tabs/pages
    useEffect(() => {
        const syncCart = () => setCart(getLocalCart());
        const syncProfiles = () => {
            const updated = loadProfiles();
            setProfiles(updated);
            try {
                const activeStored = JSON.parse(localStorage.getItem('fit_cloth_measurements') || 'null');
                if (activeStored?.id && updated.some(p => p.id === activeStored.id)) {
                    setSelectedProfileId(activeStored.id);
                }
            } catch {}
        };
        window.addEventListener('cart_updated', syncCart);
        window.addEventListener('storage', syncCart);
        window.addEventListener('storage', syncProfiles);
        return () => {
            window.removeEventListener('cart_updated', syncCart);
            window.removeEventListener('storage', syncCart);
            window.removeEventListener('storage', syncProfiles);
        };
    }, []);

    // Fetch product details from backend
    useEffect(() => {
        const fetchProductDetails = async () => {
            if (!id) {
                setError('No product ID specified in URL.');
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);
                const response = await fetch(`${API_BASE_URL}/api/products/${id}`);
                const result = await response.json();

                if (result.success && result.data) {
                    setProduct(result.data);
                } else {
                    setError(result.message || 'Product not found in database.');
                }
            } catch (err) {
                console.error('Fetch error:', err);
                setError('Error connecting to backend server: ' + err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchProductDetails();
    }, [id]);

    // Quantity of this product in cart for selected size & profile
    const sizeCartQty = useMemo(() => {
        if (!product) return 0;
        const prodId = String(product.id ?? product.product_code);
        return cart
            .filter(
                (item) =>
                    (String(item.id) === prodId || item.product_code === product.product_code) &&
                    item.size === selectedSize &&
                    (selectedSize !== 'CUSTOM' || item.fit_profile_id === activeProfile?.id)
            )
            .reduce((sum, item) => sum + (item.quantity || 1), 0);
    }, [cart, product, selectedSize, activeProfile]);

    // Total quantity across all sizes for this product
    const totalCartQty = useMemo(() => {
        if (!product) return 0;
        const prodId = String(product.id ?? product.product_code);
        return cart
            .filter(
                (item) => String(item.id) === prodId || item.product_code === product.product_code
            )
            .reduce((sum, item) => sum + (item.quantity || 1), 0);
    }, [cart, product]);

    const handleAddOne = () => {
        if (!product) return;
        const measurementsToAttach = selectedSize === 'CUSTOM' ? activeProfile?.measurements : null;
        const profileToAttach = selectedSize === 'CUSTOM' && activeProfile
            ? { ...activeProfile, tailorNotes }
            : null;
        addToLocalCart(product, selectedSize, measurementsToAttach, profileToAttach);
        setFeedbackToast({
            type: 'add',
            text: `✓ Added to bag (${selectedSize === 'CUSTOM' ? `AI BESPOKE: ${activeProfile?.name || 'CUSTOM'}` : selectedSize})!`,
        });
        setTimeout(() => setFeedbackToast(null), 2500);
    };

    const handleRemoveOne = () => {
        if (!product) return;
        const prodId = product.id ?? product.product_code;
        removeFromLocalCart(prodId, selectedSize, activeProfile?.id);
        setFeedbackToast({
            type: 'remove',
            text: `− Removed 1 unit (${selectedSize}) from bag`,
        });
        setTimeout(() => setFeedbackToast(null), 2500);
    };

    const handleRemoveAll = () => {
        if (!product) return;
        const prodId = product.id ?? product.product_code;
        deleteFromLocalCart(prodId, selectedSize, activeProfile?.id);
        setFeedbackToast({
            type: 'remove',
            text: `✕ Removed all units (${selectedSize}) from bag`,
        });
        setTimeout(() => setFeedbackToast(null), 2500);
    };

    if (loading) {
        return (
            <div className="w-full min-h-[75vh] bg-[#f7f6f0] flex flex-col items-center justify-center font-mono text-xs uppercase tracking-widest text-black/60 animate-pulse editorial-grid">
                <span>[ FETCHING BESPOKE PRODUCT SPECIFICATIONS... ]</span>
            </div>
        );
    }

    if (error || !product) {
        return (
            <div className="w-full min-h-[75vh] bg-[#f7f6f0] flex flex-col items-center justify-center px-5 font-mono text-center editorial-grid">
                <div className="p-6 bg-red-50 border-2 border-red-500 text-red-700 text-xs uppercase mb-6 max-w-md shadow-[4px_4px_0px_0px_rgba(239,68,68,1)]">
                    [ ERROR ]: {error || 'Product unavailable'}
                </div>
                <button
                    onClick={() => navigate('/search')}
                    className="px-6 py-3 bg-black text-white text-xs uppercase tracking-widest hover:bg-neutral-800 cursor-pointer shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                >
                    ← Return to Catalog
                </button>
            </div>
        );
    }

    const images = Array.isArray(product.image_urls) && product.image_urls.length > 0
        ? product.image_urls
        : [product.image_url || 'https://images.unsplash.com/photo-1592878904946-b3cd8ae243d0?auto=format&fit=crop&w=1200&q=85'];

    const currentImage = images[selectedImageIdx] || images[0];
    const priceFormatted = formatPriceINR(product.price_inr || product.price);

    const customization = product.customization_options || {};
    const setIncludes = Array.isArray(customization.set_includes) ? customization.set_includes : [];
    const measurementsRequired = Array.isArray(customization.measurements_required) ? customization.measurements_required : [];

    return (
        <div className="relative w-full min-h-screen bg-[#f7f6f0] text-black font-sans editorial-grid px-5 sm:px-8 md:px-12 py-10 pb-24">

            {/* Decorative Crosshairs */}
            <div className="absolute top-6 left-6 text-black/30 text-xs font-mono select-none">+</div>
            <div className="absolute top-6 right-6 text-black/30 text-xs font-mono select-none">+</div>

            <div className="max-w-7xl mx-auto w-full">

                {/* Breadcrumb / Top Bar */}
                <div className="mb-8 flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-black/10">
                    <button
                        onClick={() => navigate(-1)}
                        className="text-xs font-mono uppercase tracking-widest hover:opacity-50 transition-opacity cursor-pointer flex items-center gap-2"
                    >
                        <span>←</span> BACK TO CATALOG
                    </button>
                    <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono uppercase text-black/50">
                        {totalCartQty > 0 && (
                            <span className="bg-emerald-500 text-black border border-black font-mono font-bold text-[10px] uppercase px-2 py-0.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse"></span>
                                IN BAG: [{totalCartQty}]
                            </span>
                        )}
                        {product.product_code && (
                            <span className="bg-black text-white px-2 py-0.5">
                                CODE: {product.product_code}
                            </span>
                        )}
                        <span>AUDIENCE: [{product.target_audience || 'UNISEX'}]</span>
                    </div>
                </div>

                {/* Main Grid Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">

                    {/* Left Column: Image Showcase + Gallery (Contained Size) */}
                    <div className="lg:col-span-5 space-y-3 max-w-md mx-auto lg:max-w-none w-full">
                        <div className="bg-white border-2 border-black p-2.5 sm:p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <div className="relative w-full h-[360px] sm:h-[440px] lg:h-[470px] bg-[#f0eee6] overflow-hidden flex items-center justify-center">
                                <img
                                    src={currentImage}
                                    alt={product.name}
                                    className="w-full h-full object-contain object-center transition-all duration-300 p-2"
                                    onError={(e) => {
                                        e.target.src = 'https://images.unsplash.com/photo-1592878904946-b3cd8ae243d0?auto=format&fit=crop&w=1200&q=85';
                                    }}
                                />
                                {product.is_trending && (
                                    <span className="absolute top-3 left-3 bg-black text-white text-[9px] font-mono uppercase tracking-widest px-2.5 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)]">
                                        BESPOKE SELECTION
                                    </span>
                                )}
                                <span className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-sm text-black text-[11px] font-mono px-2 py-0.5 border border-black font-bold">
                                    ★ {product.rating || '4.9'}
                                </span>
                            </div>
                        </div>

                        {/* Image Gallery Thumbnails if multiple */}
                        {images.length > 1 && (
                            <div className="flex gap-2.5 overflow-x-auto pb-1">
                                {images.map((imgUrl, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setSelectedImageIdx(idx)}
                                        className={`w-16 h-20 bg-[#f0eee6] border-2 flex-shrink-0 overflow-hidden transition-all cursor-pointer p-1 flex items-center justify-center ${
                                            selectedImageIdx === idx
                                                ? 'border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] scale-105'
                                                : 'border-black/30 opacity-70 hover:opacity-100'
                                        }`}
                                    >
                                        <img src={imgUrl} alt="" className="w-full h-full object-contain" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right Column: Garment Specifications & Actions */}
                    <div className="lg:col-span-7 flex flex-col space-y-6">

                        {/* Title & Category Header */}
                        <div>
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                <span className="text-[11px] font-mono font-bold tracking-widest uppercase text-red-600">
                                    [ {formatCategoryName(product.category)} ]
                                </span>
                                <span className="text-black/30">•</span>
                                <span className="text-xs font-mono text-black/60 uppercase">
                                    {product.fit_type || 'CUSTOM TAILORED'}
                                </span>
                            </div>

                            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter uppercase font-sans leading-tight">
                                {product.name}
                            </h1>

                            <div className="mt-4 flex items-baseline gap-3">
                                <span className="text-3xl font-mono font-black text-black">
                                    {priceFormatted}
                                </span>
                                <span className="text-[11px] font-mono uppercase text-neutral-500">
                                    [ INCL. BESPOKE ESTIMATION ]
                                </span>
                            </div>
                        </div>

                        {/* Color Options */}
                        {Array.isArray(product.colors) && product.colors.length > 0 && (
                            <div className="space-y-2">
                                <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 block">
                                    PALETTE:
                                </span>
                                <div className="flex flex-wrap gap-2">
                                    {product.colors.map((c, i) => (
                                        <span
                                            key={i}
                                            className="px-2.5 py-1 text-xs font-mono uppercase bg-white border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)]"
                                        >
                                            {c}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Description */}
                        <div className="border-t border-b border-black/15 py-5 space-y-2">
                            <span className="text-[10px] font-mono uppercase tracking-widest text-black/50 block">
                                // GARMENT OVERVIEW & MATERIAL
                            </span>
                            <p className="text-sm font-medium text-black/85 leading-relaxed">
                                {product.description}
                            </p>
                            {product.fabric_composition && (
                                <p className="text-xs font-mono text-neutral-600 pt-1">
                                    FABRIC: {product.fabric_composition}
                                </p>
                            )}
                        </div>

                        {/* Set Contents if formal/traditional set */}
                        {setIncludes.length > 0 && (
                            <div className="p-4 bg-white border border-black space-y-2">
                                <span className="text-[10px] font-mono uppercase tracking-widest text-red-600 font-bold block">
                                    ✦ SET INCLUDES:
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                    {setIncludes.map((item, idx) => (
                                        <span
                                            key={idx}
                                            className="text-xs font-mono uppercase bg-neutral-100 border border-neutral-300 px-2 py-0.5"
                                        >
                                            ✓ {item}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Size / Fit Selection */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-xs font-mono uppercase">
                                <span className="font-bold">FIT SPECIFICATION:</span>
                                <span
                                    onClick={() => navigate('/fit')}
                                    className="text-neutral-500 underline cursor-pointer hover:text-black"
                                >
                                    PROPORTION ENGINE →
                                </span>
                            </div>
                            <div className="grid grid-cols-5 gap-2">
                                {['CUSTOM', 'S', 'M', 'L', 'XL'].map((size) => (
                                    <button
                                        key={size}
                                        type="button"
                                        onClick={() => setSelectedSize(size)}
                                        className={`py-3 px-1 text-xs font-mono font-bold uppercase tracking-wider border-2 transition-all cursor-pointer flex flex-col items-center justify-center ${
                                            selectedSize === size
                                                ? 'bg-black text-white border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                                                : 'bg-white text-black border-black/30 hover:border-black'
                                        }`}
                                    >
                                        <span>{size === 'CUSTOM' ? '⚡ CUSTOM' : size}</span>
                                        {size === 'CUSTOM' && (
                                            <span
                                                className={`text-[8px] font-normal tracking-tight block mt-0.5 ${
                                                    selectedSize === size ? 'text-emerald-400 font-bold' : 'text-emerald-600'
                                                }`}
                                            >
                                                {activeProfile?.measurements ? 'AI BESPOKE' : 'AI FIT'}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* When CUSTOM (AI FIT) is selected: Dedicated Bespoke Configuration & Tailor Notes */}
                        {selectedSize === 'CUSTOM' && (
                            activeProfile?.measurements ? (
                                <div className="p-4 bg-emerald-50 border-2 border-emerald-600 shadow-[3px_3px_0px_0px_rgba(5,150,105,1)] text-black font-mono space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200 pb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black uppercase bg-emerald-700 text-white px-2 py-0.5 tracking-wider flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                                                AI BESPOKE FIT ACTIVE
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px]">
                                            <button
                                                type="button"
                                                onClick={() => navigate(`/fit?profileId=${activeProfile.id}`)}
                                                className="underline text-emerald-900 hover:text-black font-bold uppercase cursor-pointer"
                                                title="Edit this AI fit profile in the Proportion Engine"
                                            >
                                                [ ✎ EDIT PROFILE IN ENGINE ]
                                            </button>
                                            <span>•</span>
                                            <button
                                                type="button"
                                                onClick={() => navigate('/fit?new=true')}
                                                className="underline text-neutral-600 hover:text-black font-bold uppercase cursor-pointer"
                                                title="Calibrate a brand new fit instance"
                                            >
                                                [ ＋ NEW FIT ]
                                            </button>
                                        </div>
                                    </div>

                                    {/* Profile Selector if multiple profiles exist */}
                                    {profiles.length > 1 ? (
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase font-bold text-emerald-950 flex items-center justify-between">
                                                <span>SELECT SAVED AI FIT INSTANCE:</span>
                                                <span className="text-neutral-500 font-normal">({profiles.length} PROFILES FOUND)</span>
                                            </label>
                                            <select
                                                value={activeProfile.id}
                                                onChange={(e) => {
                                                    const pid = e.target.value;
                                                    setSelectedProfileId(pid);
                                                    const found = profiles.find(p => p.id === pid);
                                                    if (found) {
                                                        localStorage.setItem('fit_cloth_measurements', JSON.stringify(found));
                                                        setTailorNotes(found.tailorNotes || '');
                                                    }
                                                }}
                                                className="w-full bg-white border-2 border-black p-2 font-mono text-xs uppercase font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer focus:outline-none"
                                            >
                                                {profiles.map(p => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.name || 'Untitled Fit'} ({p.gender?.toUpperCase() || 'MALE'} • {p.height} CM • {p.fitPreference || 'TAILORED'})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between text-xs font-mono bg-white/70 p-2 border border-emerald-200">
                                            <span className="font-bold text-emerald-950">
                                                PROFILE: [{activeProfile.name || 'Primary Fit'}]
                                            </span>
                                            <span className="text-[10px] text-neutral-600 uppercase">
                                                {activeProfile.gender?.toUpperCase()} • {activeProfile.height} CM • {activeProfile.fitPreference || 'TAILORED'}
                                            </span>
                                        </div>
                                    )}

                                    {/* Key Body Dimensions Summary */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-white p-2.5 border border-emerald-300">
                                        <div>
                                            <span className="text-neutral-500 text-[9px] uppercase block">CHEST</span>
                                            <strong className="text-black font-mono">
                                                {activeProfile.measurements.upper_body?.chest_circumference || '—'} cm
                                            </strong>
                                        </div>
                                        <div>
                                            <span className="text-neutral-500 text-[9px] uppercase block">WAIST</span>
                                            <strong className="text-black font-mono">
                                                {activeProfile.measurements.upper_body?.waist_circumference || '—'} cm
                                            </strong>
                                        </div>
                                        <div>
                                            <span className="text-neutral-500 text-[9px] uppercase block">HIPS</span>
                                            <strong className="text-black font-mono">
                                                {activeProfile.measurements.upper_body?.hip_seat_circumference || '—'} cm
                                            </strong>
                                        </div>
                                        <div>
                                            <span className="text-neutral-500 text-[9px] uppercase block">INSEAM</span>
                                            <strong className="text-black font-mono">
                                                {activeProfile.measurements.lower_body?.inseam || '—'} cm
                                            </strong>
                                        </div>
                                    </div>

                                    {/* Direct Instructions to Master Tailor (Description Box) */}
                                    <div className="space-y-1.5 pt-1">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] uppercase font-bold text-emerald-950 flex items-center gap-1.5">
                                                <span>✎</span>
                                                <span>DIRECT INSTRUCTIONS TO TAILOR:</span>
                                            </label>
                                            <span className="text-[9px] text-emerald-800 uppercase font-bold">
                                                ATTACHED TO ORDER
                                            </span>
                                        </div>
                                        <textarea
                                            value={tailorNotes}
                                            onChange={(e) => handleTailorNotesChange(e.target.value)}
                                            placeholder="Write anything you want for the tailor (e.g., loose cuffs, extra 2cm chest ease, tapered trouser bottoms, special posture adjustment)..."
                                            className="w-full h-20 p-2.5 bg-white border-2 border-black font-mono text-xs focus:outline-none focus:ring-1 focus:ring-black resize-none placeholder:text-neutral-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                        />
                                        <p className="text-[9px] font-mono text-neutral-600">
                                            These bespoke notes will be submitted directly to our master tailor during garment cutting.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 bg-neutral-100 border-2 border-dashed border-black/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-black font-bold">
                                            <span className="text-red-600">✦</span>
                                            <span>NO AI FIT PROFILE FOUND YET</span>
                                        </div>
                                        <p className="text-neutral-600 text-[11px]">
                                            Stand in T-posture for a quick front & side photo to extract your bespoke tailor measurements.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => navigate('/fit?new=true')}
                                        className="text-xs font-bold uppercase bg-black text-white px-4 py-2.5 hover:bg-neutral-800 transition-colors cursor-pointer shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] text-center whitespace-nowrap"
                                    >
                                        [ CALIBRATE AI FIT NOW → ]
                                    </button>
                                </div>
                            )
                        )}

                        {/* Bag Actions: Add, - Decrement, + Increment, and Remove */}
                        <div className="space-y-3 pt-2">
                            {sizeCartQty === 0 ? (
                                <button
                                    onClick={handleAddOne}
                                    className="w-full py-4 sm:py-5 bg-black text-white text-xs sm:text-sm font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer flex items-center justify-center gap-3"
                                >
                                    <span>[ ADD TO BAG ({selectedSize}) ]</span>
                                    <span className="font-mono">— {priceFormatted}</span>
                                </button>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        {/* Stepper with - and + buttons */}
                                        <div className="flex items-center border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                            <button
                                                type="button"
                                                onClick={handleRemoveOne}
                                                title="Remove 1 unit from bag"
                                                className="px-5 py-4 bg-neutral-100 hover:bg-red-500 hover:text-white text-black font-mono font-black text-xl cursor-pointer border-r-2 border-black active:bg-neutral-300 transition-colors"
                                            >
                                                −
                                            </button>
                                            <div className="px-5 py-3 font-mono text-center min-w-[130px] flex-1">
                                                <span className="text-[9px] uppercase tracking-widest text-emerald-600 font-bold flex items-center justify-center gap-1.5">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> IN BAG ({selectedSize})
                                                </span>
                                                <span className="font-black text-base text-black">
                                                    {sizeCartQty} {sizeCartQty === 1 ? 'UNIT' : 'UNITS'}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleAddOne}
                                                title="Add 1 more unit to bag"
                                                className="px-5 py-4 bg-black hover:bg-neutral-800 text-white font-mono font-black text-xl cursor-pointer border-l-2 border-black active:bg-neutral-900 transition-colors"
                                            >
                                                +
                                            </button>
                                        </div>

                                        {/* Quick Add More button */}
                                        <button
                                            type="button"
                                            onClick={handleAddOne}
                                            className="flex-1 py-4 bg-black text-white text-xs sm:text-sm font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer flex items-center justify-center gap-2"
                                        >
                                            <span>+ ADD ANOTHER ({selectedSize})</span>
                                        </button>
                                    </div>

                                    {/* Action Links */}
                                    <div className="flex items-center justify-between text-[11px] font-mono uppercase px-1">
                                        <button
                                            type="button"
                                            onClick={handleRemoveAll}
                                            className="text-red-600 hover:underline cursor-pointer flex items-center gap-1 font-bold"
                                        >
                                            <span>✕</span> REMOVE ALL ({selectedSize})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => navigate('/cart')}
                                            className="text-black hover:underline cursor-pointer font-bold"
                                        >
                                            VIEW BAG [{cart.reduce((s, i) => s + (i.quantity || 1), 0)}] →
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Alert when items of this product exist in other sizes */}
                            {sizeCartQty === 0 && totalCartQty > 0 && (
                                <div className="flex items-center justify-between p-3 bg-neutral-100 border border-black/20 text-[11px] font-mono uppercase text-neutral-600">
                                    <span>NOTE: {totalCartQty} unit(s) of this garment in other size(s) in bag</span>
                                    <button
                                        type="button"
                                        onClick={() => navigate('/cart')}
                                        className="underline font-bold text-black hover:text-red-600 cursor-pointer"
                                    >
                                        View Bag →
                                    </button>
                                </div>
                            )}

                            {/* Added / Removed Feedback Toast */}
                            {feedbackToast && (
                                <div
                                    className={`p-3.5 border-2 font-mono text-xs uppercase tracking-wider text-center font-bold animate-fadeIn shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] ${
                                        feedbackToast.type === 'remove'
                                            ? 'bg-amber-50 border-amber-600 text-amber-900'
                                            : 'bg-emerald-50 border-emerald-600 text-emerald-900'
                                    }`}
                                >
                                    {feedbackToast.text}
                                </div>
                            )}
                        </div>

                        {/* Tailoring & AI Proportion Guarantee */}
                        <div className="p-5 bg-neutral-200/60 border border-black/15 rounded-sm space-y-2 text-xs font-mono text-black/80">
                            <div className="font-bold uppercase text-black flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                                BESPOKE TAILORING GUARANTEE
                            </div>
                            <p className="leading-relaxed">
                                {product.tailoring_details || 'Made to order. Body measurements are estimated using our 3D proportion pipeline to ensure the ideal silhouette.'}
                            </p>
                            {measurementsRequired.length > 0 && (
                                <div className="pt-2 text-[10px] text-neutral-600 border-t border-black/10">
                                    KEY METRICS: {measurementsRequired.join(', ').toUpperCase()}
                                </div>
                            )}
                        </div>

                    </div>

                </div>

            </div>
        </div>
    );
};

export default ProductDetailPage;