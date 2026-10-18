import React from 'react';

const TechSection = () => {
    const steps = [
        {
            step: '01',
            title: 'CAPTURE YOUR VIEWS',
            desc: "Provide guided photos to help our system understand your body's visible proportions.",
            tag: 'VISUAL DATA',
        },
        {
            step: '02',
            title: 'ESTIMATE YOUR MEASUREMENTS',
            desc: 'AI analyzes visual information to estimate key body measurements.',
            tag: 'PROPORTION ENGINE',
        },
        {
            step: '03',
            title: 'MAKE MORE INFORMED CHOICES',
            desc: 'Use your estimated measurements as a starting point for understanding fit and exploring clothing options.',
            tag: 'PERSONALIZED FIT',
        },
    ];

    return (
        <section id="technology" className="relative w-full scroll-mt-20 bg-[#f7f6f0] text-black py-20 md:py-28 px-5 sm:px-8 md:px-12 border-b border-black editorial-grid overflow-hidden">

            {/* Technical Decorative Crosshairs & Coordinates */}
            <div className="absolute top-8 left-8 text-black/30 text-xs font-mono">+</div>
            <div className="absolute top-8 right-8 text-black/30 text-xs font-mono">+</div>
            <div className="absolute bottom-8 left-8 text-black/30 text-xs font-mono">+</div>
            <div className="absolute top-1/2 right-12 text-black/20 text-xs font-mono hidden md:block">+</div>

            <div className="max-w-7xl mx-auto w-full relative z-10">

                {/* Section Tag Header */}
                <div className="flex flex-wrap items-center gap-3 mb-6">
                    <span className="text-[11px] font-mono font-bold tracking-widest uppercase text-red-600">
                        [ 03 // THE TECHNOLOGY ]
                    </span>
                    <div className="w-12 h-[1px] bg-black/20"></div>
                    <span className="font-editorial italic text-base text-neutral-600">
                        intelligent estimation pipeline
                    </span>
                </div>

                {/* Heading & Subtitle */}
                <div className="max-w-3xl mb-16">
                    <h2 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tighter uppercase leading-[0.92] font-sans text-black">
                        YOUR BODY,<br />
                        <span className="text-transparent" style={{ WebkitTextStroke: '2px black' }}>
                            UNDERSTOOD DIFFERENTLY.
                        </span>
                    </h2>
                    <p className="mt-4 text-base sm:text-lg font-medium text-black/75">
                        A more personal fit experience begins with better information.
                    </p>
                </div>

                {/* 3-Step Process Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
                    {steps.map((item, index) => (
                        <div
                            key={index}
                            className="bg-neutral-100/80 border border-black/20 p-8 rounded-sm relative flex flex-col justify-between hover:border-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 group"
                        >
                            {/* Top Card Row */}
                            <div>
                                <div className="flex items-center justify-between mb-8">
                                    <span className="text-3xl font-black font-mono tracking-tighter text-black group-hover:text-red-600 transition-colors">
                                        {item.step}.
                                    </span>
                                    <span className="text-[10px] font-mono tracking-widest uppercase bg-black text-white px-2.5 py-1">
                                        {item.tag}
                                    </span>
                                </div>

                                <h3 className="text-lg font-black uppercase tracking-tight text-black mb-3">
                                    {item.title}
                                </h3>

                                <p className="text-sm font-medium text-black/70 leading-relaxed">
                                    {item.desc}
                                </p>
                            </div>

                            {/* Bottom Card Line */}
                            <div className="mt-8 pt-4 border-t border-black/10 flex items-center justify-between text-[10px] font-mono uppercase text-black/50">
                                <span>STAGE //{item.step}</span>
                                <span>✦</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Disclaimer Box */}
                <div className="mt-12 p-4 sm:p-5 bg-black/5 border border-dashed border-black/30 rounded-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono text-black/70">
                    <div className="flex items-center gap-2">
                        <span className="text-red-600 font-bold">ℹ</span>
                        <span className="uppercase tracking-wider">
                            <strong>DISCLAIMER:</strong> Measurements are estimates and may vary with photo quality, pose, clothing, and other factors.
                        </span>
                    </div>
                    <span className="text-[10px] opacity-60 uppercase whitespace-nowrap">[ ACCURACY PROTOCOL ]</span>
                </div>

            </div>
        </section>
    );
};

export default TechSection;