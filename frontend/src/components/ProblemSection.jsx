import React from 'react';

const ProblemSection = () => {
    return (
        <section id="problem" className="relative w-full scroll-mt-20 bg-[#f7f6f0] text-black py-20 md:py-28 px-5 sm:px-8 md:px-12 border-b border-black editorial-grid overflow-hidden">

            {/* Decorative Technical Crosshairs */}
            <div className="absolute top-8 left-8 text-black/30 text-xs font-mono">+</div>
            <div className="absolute top-8 right-8 text-black/30 text-xs font-mono">+</div>
            <div className="absolute bottom-8 left-8 text-black/30 text-xs font-mono">+</div>
            <div className="absolute bottom-8 right-8 text-black/30 text-xs font-mono">+</div>

            <div className="max-w-7xl mx-auto w-full">

                {/* Section Header Tag */}
                <div className="flex items-center gap-3 mb-6">
                    <span className="text-[11px] font-mono font-bold tracking-widest uppercase text-neutral-500">
                        [ 02 // THE PROBLEM ]
                    </span>
                    <div className="w-12 h-[1px] bg-black/20"></div>
                    <span className="font-editorial italic text-sm text-neutral-600">standardization vs reality</span>
                </div>

                {/* Main Headline Split Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">

                    {/* Left Column: Big Statement */}
                    <div className="lg:col-span-7">
                        <h2 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tighter uppercase leading-[0.92] font-sans text-black">
                            CLOTHES ARE MADE IN SIZES.<br />
                            <span className="text-transparent" style={{ WebkitTextStroke: '2px black' }}>
                                PEOPLE AREN'T.
                            </span>
                        </h2>
                    </div>

                    {/* Right Column: Elaborative Narrative */}
                    <div className="lg:col-span-5 flex flex-col space-y-6 pt-2">
                        <p className="text-base sm:text-lg font-medium text-black/80 leading-relaxed">
                            Two people can wear the same size and have completely different proportions. Yet we're expected to fit ourselves into standardized charts and hope for the best.
                        </p>
                        <div className="p-6 bg-black text-white rounded-sm border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
                            <span className="font-mono text-xs uppercase tracking-widest text-neutral-400 block mb-2">
                // THE CORE PHILOSOPHY
                            </span>
                            <p className="font-editorial italic text-xl sm:text-2xl leading-snug">
                                "We believe there's a better way. A way that starts with you."
                            </p>
                        </div>
                    </div>

                </div>

                {/* Comparison Grid / Breakdown Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-16 pt-16 border-t border-black/15">

                    {/* Card 1: Traditional Fashion */}
                    <div className="p-8 bg-neutral-200/50 border border-black/10 rounded-sm relative group hover:bg-neutral-200 transition-colors">
                        <span className="absolute top-4 right-6 font-mono text-xs text-black/40">[ 01 ]</span>
                        <h3 className="text-xs font-mono font-bold tracking-widest uppercase text-red-600 mb-3">
                            TRADITIONAL RETAIL
                        </h3>
                        <h4 className="text-xl font-bold uppercase tracking-tight mb-2">One-Size-Fits-None</h4>
                        <p className="text-sm text-black/70 leading-relaxed font-medium">
                            Rigid sizing charts, high return rates, guesswork, and standardized silhouettes that ignore unique human proportions.
                        </p>
                    </div>

                    {/* Card 2: Fit Cloths Approach */}
                    <div className="p-8 bg-black text-white border border-black rounded-sm relative group shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)]">
                        <span className="absolute top-4 right-6 font-mono text-xs text-white/40">[ 02 ]</span>
                        <h3 className="text-xs font-mono font-bold tracking-widest uppercase text-neutral-400 mb-3">
                            THE GOLDX STANDARD
                        </h3>
                        <h4 className="text-xl font-bold uppercase tracking-tight mb-2">Proportion-First Design</h4>
                        <p className="text-sm text-white/80 leading-relaxed font-medium">
                            Intelligent estimation of visual proportions built to eliminate guesswork and make fashion feel personal again.
                        </p>
                    </div>

                </div>

            </div>
        </section>
    );
};

export default ProblemSection;