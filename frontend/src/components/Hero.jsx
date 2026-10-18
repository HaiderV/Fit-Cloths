import React from 'react';

const Hero = ({ onDiscoverClick }) => {
    return (
        <section id="top" className="relative w-full min-h-[calc(100vh-76px)] bg-[#f7f6f0] text-black overflow-hidden flex flex-col justify-between px-5 sm:px-8 md:px-12 pt-6 md:pt-10 pb-0 border-b border-black editorial-grid">

            {/* ============================================================ */}
            {/* SVG CLIP PATH DEFINITION FOR ARCH SHAPE                      */}
            {/* ============================================================ */}
            <svg width="0" height="0" className="absolute pointer-events-none" aria-hidden="true">
                <defs>
                    <clipPath id="editorialArch" clipPathUnits="objectBoundingBox">
                        {/* 
                            Asymmetrical Arch / Dome identical to reference (IGIN style):
                            Left side starts low (~68%), sweeping parabolic curve up to the top,
                            flat top edge with rounded top-right corner, straight right edge,
                            rounded bottom corners.
                        */}
                        <path d="M 0,0.68 C 0,0.26 0.22,0 0.58,0 L 0.94,0 C 0.98,0 1,0.02 1,0.06 L 1,0.95 C 1,0.98 0.98,1 0.95,1 L 0.05,1 C 0.02,1 0,0.98 0,0.95 Z" />
                    </clipPath>
                </defs>
            </svg>

            {/* ============================================================ */}
            {/* BACKGROUND DECORATIVE ACCENTS: RED CURVED LINE, DOTS & MARKS */}
            {/* ============================================================ */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
                {/* Signature Red Curved Spline Line (from top left down) */}
                {/* Signature Red Curved Spline Line - Only visible on desktop/tablet */}
                <svg
                    className="hidden md:block absolute left-0 top-0 w-24 sm:w-40 md:w-56 h-full stroke-red-500 fill-none opacity-80"
                    viewBox="0 0 200 900"
                    preserveAspectRatio="none"
                >
                    <path
                        d="M 30,0 C 15,220 85,420 35,650 S 75,850 40,900"
                        strokeWidth="1.75"
                        strokeDasharray="none"
                    />
                    <circle cx="30" cy="80" r="3.5" fill="#ef4444" />
                    <circle cx="48" cy="460" r="2.5" fill="#ef4444" />
                </svg>

                {/* Technical Crosshairs (+) at key grid points */}
                <span className="absolute top-6 left-6 text-black/30 text-xs font-mono">+</span>
                <span className="absolute top-6 right-8 text-black/30 text-xs font-mono">+</span>
                <span className="absolute top-1/2 left-1/3 text-black/20 text-xs font-mono hidden md:block">+</span>
                <span className="absolute bottom-20 left-12 text-black/25 text-xs font-mono">+</span>

                {/* Random Dot Matrix Clusters */}
                <div className="absolute top-16 right-16 grid grid-cols-4 gap-2 opacity-20 hidden md:grid">
                    {Array.from({ length: 16 }).map((_, i) => (
                        <div key={i} className="w-1 h-1 rounded-full bg-black"></div>
                    ))}
                </div>

                <div className="absolute bottom-24 left-1/4 grid grid-cols-3 gap-1.5 opacity-25 hidden sm:grid">
                    {Array.from({ length: 9 }).map((_, i) => (
                        <div key={i} className="w-1 h-1 rounded-full bg-neutral-700"></div>
                    ))}
                </div>

                {/* Random Accent Dots & Circles */}
                <div className="absolute top-28 left-48 w-1.5 h-1.5 rounded-full bg-red-400 opacity-60 hidden lg:block"></div>
                <div className="absolute top-1/3 right-1/4 w-2 h-2 rounded-full border border-black/40 opacity-40"></div>
                <div className="absolute bottom-32 right-12 w-3 h-3 rounded-full border border-dashed border-black/30 opacity-50"></div>

                {/* Subtle Coordinate Stamp */}
                <div className="absolute top-8 right-24 text-[10px] font-mono tracking-widest text-black/35 uppercase hidden lg:block">
                    [ LAT 37.5665° N // FIT://01 ]
                </div>
            </div>

            {/* ============================================================ */}
            {/* MAIN CONTENT GRID: LEFT TYPOGRAPHY + RIGHT ARCH IMAGE        */}
            {/* ============================================================ */}
            <div className="relative z-10 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center my-auto py-6 sm:py-8 lg:py-10">

                {/* -------------------------------------------------------- */}
                {/* LEFT COLUMN: EDITORIAL BRUTALIST COPY & ACTIONS           */}
                {/* -------------------------------------------------------- */}
                <div className="lg:col-span-7 flex flex-col justify-center space-y-4 sm:space-y-5 lg:space-y-6">

                    {/* Top Script Tag & Red Category Tag */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <span className="font-editorial italic text-base sm:text-lg text-neutral-600">
                            fashion, understood personally
                        </span>
                        <span className="text-black/30 text-xs select-none">•</span>
                        <span className="text-[11px] font-mono font-bold tracking-widest uppercase text-red-600">
                            ✦ AI-POWERED BESPOKE PROPORTION LAB
                        </span>
                    </div>

                    {/* Towering Brutalist Heading */}
                    <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter uppercase leading-[0.88] font-sans text-black">
                        YOUR BODY.<br />
                        <span className="text-transparent" style={{ WebkitTextStroke: '2px black' }}>
                            YOUR FIT.
                        </span><br />
                        YOUR RULES.
                    </h1>

                    {/* Editorial Script Subhead (IGIN Style) */}
                    <div className="font-editorial italic text-2xl sm:text-3xl text-neutral-800 tracking-tight">
                        Such a well-tailored fit.
                    </div>

                    {/* Editorial Paragraph */}
                    <p className="text-sm sm:text-base font-medium text-black/75 max-w-xl leading-relaxed">
                        Fashion is personal. Finding the right fit should be, too.
                        <strong className="text-black font-bold"> FIT CLOTHS</strong> analyzes your visible body proportions using intelligent estimation — so you never guess your clothing size again.
                    </p>

                    {/* Call to Action Button & Tag */}
                    <div className="pt-2 sm:pt-3 flex flex-wrap items-center gap-4">
                        <button
                            onClick={onDiscoverClick}
                            className="px-7 py-3.5 bg-black text-white text-xs sm:text-sm font-bold uppercase tracking-widest rounded-full hover:bg-neutral-800 transition-all duration-200 cursor-pointer shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)] active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-2"
                        >
                            <span>[ DISCOVER YOUR FIT ]</span>
                            <span className="text-xs">→</span>
                        </button>
                    </div>

                    {/* Metrics Row (Directly matching reference layout) */}
                    <div className="pt-4 sm:pt-6 border-t border-black/15 sm:flex sm:flex-wrap items-center gap-2 sm:gap-10 text-xs font-mono uppercase grid grid-cols-3">
                        <div>
                            <span className="block font-black text-xl sm:text-2xl text-black">98.4%</span>
                            <span className="text-black/60 text-[10px] tracking-wider">FIT PRECISION</span>
                        </div>
                        <div className="border-l border-black/15 pl-6 sm:pl-10">
                            <span className="block font-black text-xl sm:text-2xl text-black">0</span>
                            <span className="text-black/60 text-[10px] tracking-wider">TAPE MEASURES</span>
                        </div>
                        <div className="border-l border-black/15 pl-6 sm:pl-10">
                            <span className="block font-black text-xl sm:text-2xl text-black">3D</span>
                            <span className="text-black/60 text-[10px] tracking-wider">PROPORTION MESH</span>
                        </div>

                        {/* Hand-drawn heart doodle */}
                        <div className="ml-auto text-xl text-neutral-400 select-none hidden sm:block">
                            ♡
                        </div>
                    </div>
                </div>

                {/* -------------------------------------------------------- */}
                {/* RIGHT COLUMN: ARCHED EDITORIAL IMAGE FRAME               */}
                {/* -------------------------------------------------------- */}
                <div className="lg:col-span-5 flex justify-center items-center relative mt-4 lg:mt-0">

                    {/* Outer Drop Shadow Wrapper */}
                    <div className="relative w-full max-w-[340px] sm:max-w-[400px] lg:max-w-[460px] aspect-[4/5] filter drop-shadow-[0_15px_25px_rgba(0,0,0,0.12)]">

                        {/* Arched Clipped Container */}
                        <div
                            className="w-full h-full relative overflow-hidden bg-neutral-200"
                            style={{ clipPath: 'url(#editorialArch)' }}
                        >
                            {/* Editorial Model Image */}
                            <img
                                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=1200&auto=format&fit=crop"
                                alt="Fit Cloths Editorial Model"
                                className="w-full h-full object-cover object-center filter contrast-[1.05] brightness-[1.02] hover:scale-105 transition-transform duration-700"
                            />

                            {/* Soft Editorial Gradient Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none"></div>

                            {/* Floating Model Badge Inside Image */}
                            <div className="absolute bottom-5 left-5 text-white font-mono text-[10px] uppercase tracking-widest bg-black/85 px-3 py-1.5 border border-white/20 backdrop-blur-sm rounded-sm">
                                FIT CLOTHS // MODEL 01
                            </div>
                        </div>

                        {/* Arched SVG Outline Border for Crisp Editorial Edge */}
                        <svg
                            className="absolute inset-0 w-full h-full pointer-events-none fill-none stroke-black/20"
                            viewBox="0 0 100 100"
                            preserveAspectRatio="none"
                        >
                            <path
                                d="M 0,68 C 0,26 22,0 58,0 L 94,0 C 98,0 100,2 100,6 L 100,95 C 100,98 98,100 95,100 L 5,100 C 2,100 0,98 0,95 Z"
                                strokeWidth="0.8"
                                vectorEffect="non-scaling-stroke"
                            />
                        </svg>

                        {/* Squiggly Hand-drawn Coil Doodle (like in reference) */}
                        <svg
                            className="absolute -top-6 left-12 w-16 h-8 stroke-black/40 fill-none pointer-events-none"
                            viewBox="0 0 80 40"
                        >
                            <path
                                d="M 5,25 Q 20,5 35,20 T 65,15"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                            />
                        </svg>

                        {/* Floating Star / Sparkle Accent */}
                        <div className="absolute -top-4 -right-2 text-2xl font-light text-black/50 select-none">
                            ✦
                        </div>

                        {/* Floating Smile Badge (matching IGIN bottom badge) */}
                        <div className="absolute -bottom-3 -right-3 w-8 h-8 rounded-full bg-white border border-black/20 shadow-md flex items-center justify-center text-sm select-none text-black/70">
                            ☺
                        </div>
                    </div>
                </div>

            </div>

            {/* ============================================================ */}
            {/* BOTTOM MARQUEE / TICKER BAR WITH SERRATED / ZIGZAG EDGE      */}
            {/* ============================================================ */}
            <div className="relative w-[calc(100%+2.5rem)] sm:w-[calc(100%+4rem)] md:w-[calc(100%+6rem)] -mx-5 sm:-mx-8 md:-mx-12 mt-6 select-none">

                {/* Serrated / Zigzag Top Border (IGIN Ribbon Style) */}
                <div className="w-full h-2 overflow-hidden leading-none block">
                    <svg
                        className="w-full h-2 text-black fill-current block"
                        viewBox="0 0 1200 8"
                        preserveAspectRatio="none"
                    >
                        <pattern id="sawtooth" width="16" height="8" patternUnits="userSpaceOnUse">
                            <polygon points="0,8 8,0 16,8" fill="black" />
                        </pattern>
                        <rect width="1200" height="8" fill="url(#sawtooth)" />
                    </svg>
                </div>

                {/* Solid Black Ticker Ribbon */}
                <div className="bg-black text-white py-3 overflow-hidden border-b border-black">
                    <div className="whitespace-nowrap flex items-center space-x-8 animate-marquee text-[11px] font-mono uppercase tracking-widest">
                        <span>✦ FIT CLOTHS</span>
                        <span>•</span>
                        <span>YOUR BODY // YOUR FIT // YOUR RULES</span>
                        <span>•</span>
                        <span>DISTILLED BESPOKE</span>
                        <span>♡</span>
                        <span>NO ONE-SIZE-FITS-ALL</span>
                        <span>•</span>
                        <span>GOLDX HACKATHON EDITION</span>
                        <span>☆</span>
                        <span>WHERE FITS BEGIN</span>
                        <span>✦</span>
                        <span>✦ FIT CLOTHS</span>
                        <span>•</span>
                        <span>YOUR BODY // YOUR FIT // YOUR RULES</span>
                        <span>•</span>
                        <span>DISTILLED BESPOKE</span>
                        <span>♡</span>
                        <span>NO ONE-SIZE-FITS-ALL</span>
                        <span>•</span>
                        <span>GOLDX HACKATHON EDITION</span>
                        <span>☆</span>
                        <span>WHERE FITS BEGIN</span>
                    </div>
                </div>
            </div>

        </section>
    );
};

export default Hero;