import React from 'react';

const VisionSection = ({ onExploreClick }) => {
    return (
        <section id="vision" className="relative w-full scroll-mt-20 bg-[#f7f6f0] text-black py-20 md:py-28 px-5 sm:px-8 md:px-12 border-b border-black editorial-grid overflow-hidden">

            {/* Decorative Technical Crosshairs */}
            <div className="absolute top-8 left-8 text-black/30 text-xs font-mono">+</div>
            <div className="absolute top-8 right-8 text-black/30 text-xs font-mono">+</div>
            <div className="absolute bottom-8 left-8 text-black/30 text-xs font-mono">+</div>
            <div className="absolute bottom-8 right-8 text-black/30 text-xs font-mono">+</div>

            <div className="max-w-7xl mx-auto w-full relative z-10">

                {/* Section Header Tag */}
                <div className="flex items-center gap-3 mb-8">
                    <span className="text-[11px] font-mono font-bold tracking-widest uppercase text-red-600">
                        [ 05 // THE VISION ]
                    </span>
                    <div className="w-12 h-[1px] bg-black/20"></div>
                    <span className="font-editorial italic text-base text-neutral-600">
                        looking forward
                    </span>
                </div>

                {/* Headline & Vision Body */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start mb-16">
                    <div className="lg:col-span-7">
                        <h2 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tighter uppercase leading-[0.92] font-sans text-black">
                            A FUTURE WHERE<br />
                            <span className="text-transparent" style={{ WebkitTextStroke: '2px black' }}>
                                FASHION STARTS
                            </span><br />
                            WITH YOU.
                        </h2>
                    </div>

                    <div className="lg:col-span-5 flex flex-col justify-between space-y-6 pt-2">
                        <p className="text-base sm:text-lg font-medium text-black/80 leading-relaxed">
                            We imagine a world where understanding your measurements becomes simpler, choosing clothing becomes more informed, and personal fit becomes a more accessible part of the fashion experience.
                        </p>
                        <p className="text-sm font-mono text-neutral-600 uppercase tracking-wider">
              // WE'RE BUILDING TOWARD THAT FUTURE, ONE STEP AT A TIME.
                        </p>
                    </div>
                </div>

                {/* Final CTA Box */}
                <div className="bg-black text-white p-8 sm:p-14 md:p-16 rounded-sm border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,0.3)] relative overflow-hidden text-center flex flex-col items-center justify-center space-y-6">

                    <span className="text-xs font-mono tracking-widest uppercase text-neutral-400">
                        ✦ YOUR FIT JOURNEY STARTS HERE
                    </span>

                    <h3 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tighter uppercase font-sans">
                        LESS GUESSWORK.<br />
                        <span className="text-neutral-400">MORE CONFIDENCE.</span>
                    </h3>

                    <p className="text-sm sm:text-base font-medium text-neutral-300 max-w-xl">
                        Be part of a more personal approach to fashion.
                    </p>

                    <button
                        onClick={onExploreClick}
                        className="mt-4 px-9 py-4 bg-white text-black text-xs sm:text-sm font-bold uppercase tracking-widest rounded-full hover:bg-neutral-200 transition-all cursor-pointer shadow-[3px_3px_0px_0px_rgba(255,255,255,0.3)] active:translate-x-0.5 active:translate-y-0.5"
                    >
                        [ EXPLORE FIT CLOTHS ]
                    </button>

                    <div className="pt-6 text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                        FIT CLOTHS. — FASHION, UNDERSTOOD PERSONALLY.
                    </div>
                </div>

            </div>
        </section>
    );
};

export default VisionSection;