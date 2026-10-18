import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    getLocalCart,
    addToLocalCart,
    removeFromLocalCart,
    deleteFromLocalCart,
} from '../services/productService';

const formatPriceINR = (val) => {
    const num = Number(val) || 0;
    return `₹${num.toLocaleString('en-IN')}`;
};

const CartPage = () => {
    const navigate = useNavigate();
    const [cart, setCart] = useState(getLocalCart);
    const [toastMessage, setToastMessage] = useState(null);
    const [savedMeasurements, setSavedMeasurements] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('fit_cloth_measurements') || 'null');
        } catch {
            return null;
        }
    });

    // Keep cart and measurements in real-time sync with localStorage across the app
    useEffect(() => {
        const syncCart = () => setCart(getLocalCart());
        const syncMeasurements = () => {
            try {
                setSavedMeasurements(JSON.parse(localStorage.getItem('fit_cloth_measurements') || 'null'));
            } catch {
                setSavedMeasurements(null);
            }
        };
        window.addEventListener('cart_updated', syncCart);
        window.addEventListener('storage', syncCart);
        window.addEventListener('storage', syncMeasurements);
        return () => {
            window.removeEventListener('cart_updated', syncCart);
            window.removeEventListener('storage', syncCart);
            window.removeEventListener('storage', syncMeasurements);
        };
    }, []);

    const totalUnits = useMemo(() => {
        return cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    }, [cart]);

    const subtotal = useMemo(() => {
        return cart.reduce((sum, item) => {
            const price = Number(item.price_inr || item.price) || 0;
            return sum + price * (item.quantity || 1);
        }, 0);
    }, [cart]);

    const handleIncrement = (item) => {
        addToLocalCart(item, item.size || 'CUSTOM', item.custom_measurements, {
            id: item.fit_profile_id,
            name: item.fit_profile_name,
            tailorNotes: item.tailor_notes,
            measurements: item.custom_measurements,
        });
        setToastMessage(`Increased ${item.name} quantity`);
        setTimeout(() => setToastMessage(null), 2000);
    };

    const handleDecrement = (item) => {
        const prodId = item.id ?? item.product_code;
        removeFromLocalCart(prodId, item.size, item.fit_profile_id);
        setToastMessage(`Decreased ${item.name} quantity`);
        setTimeout(() => setToastMessage(null), 2000);
    };

    const [orderedOrder, setOrderedOrder] = useState(null);

    const handleCheckout = () => {
        if (cart.length === 0) return;

        const orderCode = 'FC-ORD-' + Math.floor(100000 + Math.random() * 900000);
        const orderSummary = {
            orderCode,
            items: [...cart],
            totalUnits,
            subtotal,
            date: new Date().toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            }),
        };

        // Empty the bag in localStorage and in state
        localStorage.removeItem('fit_cloth_cart');
        setCart([]);
        window.dispatchEvent(new Event('cart_updated'));

        setOrderedOrder(orderSummary);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="relative w-full min-h-screen bg-[#f7f6f0] text-black font-sans editorial-grid px-5 sm:px-8 md:px-12 py-10 pb-28">

            {/* Toast Notification */}
            {toastMessage && (
                <div className="fixed bottom-6 right-6 z-50 bg-black text-white px-5 py-3 border border-white/20 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] font-mono text-xs uppercase tracking-wider flex items-center gap-3 animate-bounce">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* Decorative Crosshairs */}
            <div className="absolute top-6 left-6 text-black/30 text-xs font-mono select-none">+</div>
            <div className="absolute top-6 right-6 text-black/30 text-xs font-mono select-none">+</div>

            <div className="max-w-7xl mx-auto w-full">

                {/* Header */}
                <div className="mb-8 pb-6 border-b border-black/15 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-[11px] font-mono font-bold tracking-widest uppercase text-red-600">
                                [ BESPOKE ORDER PIPELINE // BAG MANIFEST ]
                            </span>
                        </div>
                        <h1 className="text-4xl sm:text-6xl font-black tracking-tighter uppercase font-sans">
                            YOUR SHOPPING BAG.
                        </h1>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-mono uppercase text-black/60">
                        <span>ITEMS: [{cart.length}]</span>
                        <span>•</span>
                        <span>TOTAL UNITS: [{totalUnits}]</span>
                    </div>
                </div>

                {/* 1. Order Confirmed Screen if checkout completed */}
                {orderedOrder ? (
                    <div className="max-w-3xl mx-auto bg-white border-2 border-black p-8 sm:p-10 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] font-mono space-y-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b-2 border-black">
                            <span className="text-[11px] font-bold tracking-widest uppercase bg-emerald-600 text-white px-2.5 py-1">
                                ✓ ORDER PLACED // CONFIRMED BY SYSTEM
                            </span>
                            <span className="text-xs font-mono text-neutral-500 uppercase">
                                {orderedOrder.date}
                            </span>
                        </div>

                        <div>
                            <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-black font-sans leading-tight">
                                ORDER PLACED SUCCESSFULLY.
                            </h2>
                            <div className="mt-3 flex flex-wrap items-baseline gap-3">
                                <span className="text-xs font-bold bg-black text-white px-3 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]">
                                    ORDER ID: {orderedOrder.orderCode}
                                </span>
                                <span className="text-xs text-neutral-600">
                                    TOTAL CHARGED: <strong>{formatPriceINR(orderedOrder.subtotal)}</strong> ({orderedOrder.totalUnits} UNITS)
                                </span>
                            </div>
                        </div>

                        {/* Tailor Pipeline Status Box */}
                        <div className="p-4 bg-emerald-50 border-2 border-emerald-600 text-xs space-y-2">
                            <div className="font-black uppercase text-emerald-950 flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span>PRODUCTION STATUS: SENT TO MASTER CUTTING TABLE</span>
                            </div>
                            <p className="text-emerald-900 leading-relaxed text-[11px]">
                                Your custom body dossier measurements and direct tailor instructions have been dispatched to our master tailoring workshop. Cutting begins within 24 hours.
                            </p>
                        </div>

                        {/* Ordered Items Manifest */}
                        <div className="space-y-3 pt-2">
                            <span className="text-xs font-bold uppercase text-black block tracking-wider">
                                // ORDER MANIFEST ({orderedOrder.items.length} ITEMS):
                            </span>
                            <div className="space-y-3">
                                {orderedOrder.items.map((item, idx) => (
                                    <div key={idx} className="p-4 bg-[#f7f6f0] border-2 border-black flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                                        <div className="space-y-1">
                                            <span className="font-bold text-xs uppercase text-black block">
                                                {item.name}
                                            </span>
                                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-neutral-600 uppercase">
                                                <span>SIZE: <strong className="text-black">{item.size === 'CUSTOM' ? '⚡ AI BESPOKE' : item.size}</strong></span>
                                                {item.fit_profile_name && (
                                                    <>
                                                        <span>•</span>
                                                        <span>PROFILE: <strong className="text-emerald-800">[{item.fit_profile_name}]</strong></span>
                                                    </>
                                                )}
                                                <span>•</span>
                                                <span>QTY: {item.quantity || 1}</span>
                                            </div>
                                            {item.tailor_notes && (
                                                <div className="pt-1">
                                                    <span className="text-[9px] font-bold uppercase text-neutral-600 block">Direct Tailor Note:</span>
                                                    <p className="text-[10px] italic text-neutral-800 bg-white p-2 border border-black/20 mt-0.5">
                                                        "{item.tailor_notes}"
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right sm:self-center">
                                            <span className="font-bold text-sm text-black whitespace-nowrap block">
                                                {formatPriceINR(Number(item.price_inr || item.price) * (item.quantity || 1))}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="pt-6 border-t-2 border-black flex flex-wrap items-center gap-4">
                            <button
                                type="button"
                                onClick={() => {
                                    setOrderedOrder(null);
                                    navigate('/search');
                                }}
                                className="py-3.5 px-6 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                            >
                                [ EXPLORE CATALOG → ]
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setOrderedOrder(null);
                                    navigate('/fit');
                                }}
                                className="py-3.5 px-5 bg-white border-2 border-black text-black text-xs font-bold uppercase tracking-widest hover:bg-neutral-100 transition-all shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
                            >
                                [ MANAGE AI FIT PROFILES ]
                            </button>
                        </div>
                    </div>
                ) : cart.length === 0 ? (
                    <div className="py-24 px-6 text-center border-2 border-dashed border-black/30 bg-white/60 space-y-5 max-w-xl mx-auto shadow-[4px_4px_0px_0px_rgba(0,0,0,0.05)]">
                        <div className="text-3xl font-mono">✦</div>
                        <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight">
                            YOUR BESPOKE BAG IS CURRENTLY EMPTY.
                        </h2>
                        <p className="text-xs font-mono text-neutral-600 uppercase tracking-wider">
                            Explore our curated catalog of Indian ethnic and formal wear tailored with AI precision.
                        </p>
                        <div className="pt-2">
                            <button
                                onClick={() => navigate('/search')}
                                className="px-6 py-3.5 bg-black text-white text-xs font-mono uppercase tracking-widest hover:bg-neutral-800 transition-all cursor-pointer shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:scale-95"
                            >
                                EXPLORE BESPOKE CATALOG →
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Two-Column Bag Content */
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">

                        {/* Left: Bag Items List */}
                        <div className="lg:col-span-8 space-y-4">
                            <div className="flex items-center justify-between pb-3 border-b border-black text-xs font-mono uppercase">
                                <span>GARMENT & SPECIFICATION</span>
                                <span>QUANTITY & PRICE</span>
                            </div>

                            <div className="space-y-4">
                                {cart.map((item, idx) => {
                                    const img = item.selected_image ||
                                        (Array.isArray(item.image_urls) && item.image_urls.length > 0 ? item.image_urls[0] : item.image_url) ||
                                        'https://images.unsplash.com/photo-1592878904946-b3cd8ae243d0?auto=format&fit=crop&w=1200&q=85';

                                    const price = Number(item.price_inr || item.price) || 0;
                                    const qty = item.quantity || 1;
                                    const lineTotal = price * qty;

                                    return (
                                        <div
                                            key={`${item.id || item.product_code}-${item.size || 'custom'}-${idx}`}
                                            className="bg-white border-2 border-black p-4 sm:p-5 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex flex-col sm:flex-row gap-5 justify-between items-start sm:items-center"
                                        >
                                            {/* Item Info with Thumbnail */}
                                            <div className="flex gap-4 items-center">
                                                <div
                                                    onClick={() => navigate(`/cloth?id=${item.id || item.product_code}`)}
                                                    className="w-20 h-24 bg-neutral-100 border border-black overflow-hidden flex-shrink-0 cursor-pointer p-1"
                                                >
                                                    <img
                                                        src={img}
                                                        alt={item.name}
                                                        className="w-full h-full object-contain"
                                                        onError={(e) => {
                                                            e.target.src = 'https://images.unsplash.com/photo-1592878904946-b3cd8ae243d0?auto=format&fit=crop&w=1200&q=85';
                                                        }}
                                                    />
                                                </div>

                                                <div className="space-y-1.5 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        {item.product_code && (
                                                            <span className="text-[9px] font-mono uppercase bg-black text-white px-1.5 py-0.5">
                                                                {item.product_code}
                                                            </span>
                                                        )}
                                                        {item.size === 'CUSTOM' ? (
                                                            <span className="text-[9px] font-mono font-bold uppercase bg-emerald-700 text-white px-2 py-0.5 flex items-center gap-1 shadow-xs">
                                                                ✦ AI BESPOKE TAILORED
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-mono uppercase text-neutral-700 bg-neutral-100 border border-neutral-300 px-1.5 py-0.5 font-bold">
                                                                SIZE: [{item.size}]
                                                            </span>
                                                        )}
                                                    </div>

                                                    <h3
                                                        onClick={() => navigate(`/cloth?id=${item.id || item.product_code}`)}
                                                        className="font-bold text-sm uppercase tracking-tight hover:underline cursor-pointer"
                                                    >
                                                        {item.name}
                                                    </h3>

                                                    {/* Bespoke AI Dimensions Specification Breakdown */}
                                                    {item.size === 'CUSTOM' && (
                                                        <div className="mt-1.5 p-2.5 bg-emerald-50 border border-emerald-300 font-mono text-[10px] text-emerald-950 space-y-1.5 max-w-md">
                                                            <div className="font-bold uppercase tracking-wider flex items-center justify-between text-[9px] text-emerald-800">
                                                                <span>// BESPOKE SPEC: {item.fit_profile_name ? `[${item.fit_profile_name.toUpperCase()}]` : 'TAILOR LOCKED'}</span>
                                                                <span className="text-emerald-700 font-bold">✓ ACTIVE FIT</span>
                                                            </div>
                                                            {(() => {
                                                                const m = item.custom_measurements || savedMeasurements?.measurements;
                                                                if (m) {
                                                                    const upper = m.upper_body || {};
                                                                    const lower = m.lower_body || {};
                                                                    return (
                                                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-2 gap-y-0.5 text-[9px] text-neutral-800">
                                                                            <span>CHEST: <strong>{upper.chest_circumference || '—'} cm</strong></span>
                                                                            <span>WAIST: <strong>{upper.waist_circumference || '—'} cm</strong></span>
                                                                            <span>HIPS: <strong>{upper.hip_seat_circumference || '—'} cm</strong></span>
                                                                            <span>INSEAM: <strong>{lower.inseam || '—'} cm</strong></span>
                                                                        </div>
                                                                    );
                                                                }
                                                                return (
                                                                    <div className="flex items-center justify-between text-neutral-700 text-[10px]">
                                                                        <span className="text-amber-800 font-medium">Pending photogrammetry profile</span>
                                                                        <span
                                                                            onClick={() => navigate('/fit')}
                                                                            className="underline font-bold text-black hover:text-emerald-800 cursor-pointer"
                                                                        >
                                                                            MEASURE NOW →
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })()}
                                                            {item.tailor_notes && (
                                                                <div className="pt-1 border-t border-emerald-200 text-[9px] text-emerald-900">
                                                                    <span className="font-bold uppercase block text-emerald-950">DIRECT INSTRUCTIONS TO TAILOR:</span>
                                                                    <p className="italic bg-white/70 p-1 border border-emerald-200 mt-0.5">"{item.tailor_notes}"</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className="text-xs font-mono text-neutral-500 pt-0.5">
                                                        {formatPriceINR(price)} per unit
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveAll(item)}
                                                        className="text-[10px] font-mono uppercase text-red-600 hover:underline cursor-pointer font-bold pt-1 block"
                                                    >
                                                        ✕ Remove Item
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Quantity Controls & Line Total */}
                                            <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-neutral-200">
                                                {/* Stepper with - and + */}
                                                <div className="flex items-center border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDecrement(item)}
                                                        title="Decrease quantity (-)"
                                                        className="w-8 h-8 flex items-center justify-center bg-neutral-100 hover:bg-red-500 hover:text-white text-black font-mono font-black text-base cursor-pointer border-r border-black active:bg-neutral-300 transition-colors"
                                                    >
                                                        −
                                                    </button>
                                                    <span className="min-w-[32px] px-2 text-center font-mono font-black text-xs text-black select-none">
                                                        {qty}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleIncrement(item)}
                                                        title="Increase quantity (+)"
                                                        className="w-8 h-8 flex items-center justify-center bg-black hover:bg-neutral-800 text-white font-mono font-black text-base cursor-pointer border-l border-black active:bg-neutral-900 transition-colors"
                                                    >
                                                        +
                                                    </button>
                                                </div>

                                                {/* Total for this line */}
                                                <div className="text-right">
                                                    <span className="block text-[9px] font-mono uppercase text-neutral-400">
                                                        TOTAL
                                                    </span>
                                                    <span className="font-mono font-black text-base text-black">
                                                        {formatPriceINR(lineTotal)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="pt-4 flex justify-between items-center text-xs font-mono uppercase">
                                <button
                                    onClick={() => navigate('/search')}
                                    className="underline hover:opacity-60 cursor-pointer flex items-center gap-1 font-bold"
                                >
                                    <span>←</span> ADD MORE GARMENTS
                                </button>
                                <button
                                    onClick={() => {
                                        localStorage.removeItem('fit_cloth_cart');
                                        window.dispatchEvent(new Event('cart_updated'));
                                    }}
                                    className="text-red-600 hover:underline cursor-pointer"
                                >
                                    Clear Bag
                                </button>
                            </div>
                        </div>

                        {/* Right: Order Summary Sidebar */}
                        <div className="lg:col-span-4 bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-6">
                            <div className="pb-3 border-b border-black">
                                <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-red-600 block mb-1">
                                    [ ESTIMATED INVOICE ]
                                </span>
                                <h2 className="text-xl font-black uppercase tracking-tight">
                                    ORDER SUMMARY
                                </h2>
                            </div>

                            <div className="space-y-3 font-mono text-xs uppercase">
                                <div className="flex justify-between text-neutral-600">
                                    <span>SUBTOTAL ({totalUnits} UNITS)</span>
                                    <span className="font-bold text-black">{formatPriceINR(subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-neutral-600">
                                    <span>AI 3D FIT ESTIMATION</span>
                                    <span className="text-emerald-600 font-bold">COMPLIMENTARY</span>
                                </div>
                                <div className="flex justify-between text-neutral-600">
                                    <span>BESPOKE DELIVERY</span>
                                    <span className="text-emerald-600 font-bold">FREE</span>
                                </div>
                                <div className="pt-3 border-t-2 border-black flex justify-between items-baseline text-sm">
                                    <span className="font-black text-black">TOTAL ESTIMATE</span>
                                    <span className="font-black text-xl text-black">{formatPriceINR(subtotal)}</span>
                                </div>
                                <span className="text-[10px] text-neutral-500 block">
                                    INCL. ALL TAXES & BESPOKE TAILORING GUARANTEE
                                </span>
                            </div>

                            <button
                                type="button"
                                onClick={handleCheckout}
                                className="w-full py-4 bg-black text-white text-xs sm:text-sm font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer flex items-center justify-center gap-2"
                            >
                                <span>CHECKOUT WITH AI FIT</span>
                                <span>→</span>
                            </button>

                            <div className="p-4 bg-neutral-100 border border-black/15 text-[11px] font-mono text-neutral-700 space-y-1">
                                <div className="font-bold text-black uppercase flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    SILHOUETTE ACCURACY PROMISE
                                </div>
                                <p className="text-[10px] text-neutral-600 leading-relaxed">
                                    Every garment is custom-tailored to your measurements. Free alterations included if fit deviation exceeds 0.5 inches.
                                </p>
                            </div>
                        </div>

                    </div>
                )}

            </div>
        </div>
    );
};

export default CartPage;