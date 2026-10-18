import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const Header = ({ cartCount = 0 }) => {
    const navigate = useNavigate();
    const location = useLocation();

    // Smooth scroll handler for landing page sections & cross-route navigation
    const handleNavClick = (id) => {
        if (location.pathname === '/') {
            if (id === 'top') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                const element = document.getElementById(id);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth' });
                }
            }
        } else {
            // If not on home page, navigate home first with scroll target
            navigate('/', { state: { scrollTo: id } });
        }
    };

    const scrollToSection = handleNavClick;

    // Handle scroll after cross-page navigation to home
    useEffect(() => {
        const targetId = location.state?.scrollTo || (location.hash ? location.hash.replace('#', '') : null);
        if (location.pathname === '/' && targetId) {
            const timer = setTimeout(() => {
                if (targetId === 'top') {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                    const element = document.getElementById(targetId);
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth' });
                    }
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [location]);

    return (
        <header className="sticky top-0 z-50 w-full bg-[#f0f0f0]/90 backdrop-blur-md border-b border-black/10 select-none">
            <div className="w-full flex items-center justify-between px-6 md:px-12 py-5 text-black font-sans tracking-widest uppercase text-xs">
                {/* Brand Logo */}
                <div
                    onClick={() => handleNavClick('top')}
                    className="font-black text-2xl tracking-tighter cursor-pointer hover:opacity-80 transition-opacity"
                >
                    FIT CLOTH<span className="text-[10px] align-super tracking-normal font-light">®</span>
                </div>

                {/* Desktop Navigation Links */}
                <nav className="hidden md:flex items-center space-x-10 font-semibold tracking-wider text-[11px]">
                    <button
                        onClick={() => handleNavClick('top')}
                        className="hover:opacity-50 transition-opacity uppercase cursor-pointer"
                    >
                        Home
                    </button>
                    <button
                        onClick={() => handleNavClick('problem')}
                        className="hover:opacity-50 transition-opacity uppercase cursor-pointer"
                    >
                        About
                    </button>
                    <button
                        onClick={() => handleNavClick('technology')}
                        className="hover:opacity-50 transition-opacity uppercase cursor-pointer"
                    >
                        Working
                    </button>
                </nav>

                {/* Actions */}
                <div className="flex items-center space-x-6 sm:space-x-8 font-semibold tracking-wider text-[11px]">
                    <button
                        onClick={() => navigate('/fit')}
                        className="hover:opacity-50 transition-opacity uppercase cursor-pointer flex items-center gap-1"
                    >
                        <span>ai fit</span>
                    </button>

                    <button
                        onClick={() => navigate('/search')}
                        className="hover:opacity-50 transition-opacity uppercase cursor-pointer flex items-center gap-1.5"
                    >
                        <span>shop</span>
                    </button>

                    <button
                        onClick={() => navigate('/cart')}
                        className="hover:opacity-50 transition-opacity uppercase cursor-pointer flex items-center gap-1"
                    >
                        <span>Bag</span>
                        <span className="font-mono text-xs">—[{cartCount}]</span>
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;