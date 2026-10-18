import React from 'react';

const PhilosophySection = () => {
    return (
        <section id="philosophy" className="relative w-full scroll-mt-20 bg-[#f7f6f0] text-black py-20 md:py-28 px-5 sm:px-8 md:px-12 border-b border-black editorial-grid overflow-hidden">

            {/* Technical Decorative Crosshairs */}
            <div className="absolute top-8 left-8 text-black/30 text-xs font-mono">+</div>
            <div className="absolute top-8 right-8 text-black/30 text-xs font-mono">+</div>
            <div className="absolute bottom-8 left-8 text-black/30 text-xs font-mono">+</div>
            <div className="absolute bottom-8 right-8 text-black/30 text-xs font-mono">+</div>

            <div className="max-w-7xl mx-auto w-full relative z-10">

                {/* Section Header Tag */}
                <div className="flex items-center gap-3 mb-8">
                    <span className="text-[11px] font-mono font-bold tracking-widest uppercase text-neutral-500">
                        [ 04 // OUR PHILOSOPHY ]
                    </span>
                    <div className="w-12 h-[1px] bg-black/20"></div>
                    <span className="font-editorial italic text-base text-neutral-600">
                        core manifesto
                    </span>
                </div>

                {/* Highlight Manifesto Statement */}
                <div className="bg-black text-white p-8 sm:p-12 md:p-16 rounded-sm border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,0.2)] relative overflow-hidden">

                    {/* Subtle Decorative Star Icon */}
                    <div className="absolute top-6 right-8 text-3xl font-light text-white/20 select-none">
                        ✦
                    </div>

                    <p className="font-editorial italic text-3xl sm:text-5xl md:text-6xl text-white leading-[1.1] max-w-5xl">
                        "Fit isn't about changing your body. It's about understanding it."
                    </p>

                    <div className="mt-8 pt-8 border-t border-white/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs font-mono uppercase tracking-widest text-neutral-400">
                        <div>MANIFESTO // FIT CLOTHS</div>
                        <div className="text-white font-bold">GOLDX DESIGN PRINCIPLE</div>
                    </div>
                </div>

                {/* Philosophy Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">

                    {/* Detail Box 1 */}
                    <div className="p-8 bg-neutral-100/80 border border-black/20 rounded-sm">
                        <h3 className="text-lg font-black uppercase tracking-tight text-black mb-3">
                            YOUR PROPORTIONS, YOUR EXPRESSION
                        </h3>
                        <p className="text-sm font-medium text-black/75 leading-relaxed">
                            Your proportions are your own. Your style is your expression. We're building technology to help make the space between your body and your clothing feel less complicated.
                        </p>
                    </div>

                    {/* Detail Box 2 */}
                    <div className="p-8 bg-neutral-100/80 border border-black/20 rounded-sm">
                        <h3 className="text-lg font-black uppercase tracking-tight text-black mb-3">
                            NO ONE-SIZE-FITS-ALL THINKING
                        </h3>
                        <p className="text-sm font-medium text-black/75 leading-relaxed">
                            We reject rigid standard charts. Just a more personal approach to fit that respects every unique silhouette.
                        </p>
                    </div>

                </div>

            </div>
        </section>
    );
};

export default PhilosophySection;