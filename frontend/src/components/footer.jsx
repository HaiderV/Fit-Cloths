import React from 'react';

const Footer = () => {
    const leaderLinks = [
        { label: 'LinkedIn', url: 'https://www.linkedin.com/in/haider-vadgamwala-220728281/' },
        { label: 'GitHub', url: 'https://github.com/HaiderV' },
        { label: 'Portfolio', url: 'https://front-end-project-7-portfolio.vercel.app/' },
    ];

    const teamMembers = ['Haider S Vadgamwala', 'N Chaitanya', 'Bharath G'];

    return (
        <footer className="relative w-full bg-black text-white py-16 md:py-20 px-5 sm:px-8 md:px-12 border-t border-black select-none overflow-hidden font-sans">

            {/* Decorative Crosshairs at corners */}
            <div className="absolute top-6 left-6 text-white/30 text-xs font-mono">+</div>
            <div className="absolute top-6 right-6 text-white/30 text-xs font-mono">+</div>
            <div className="absolute bottom-6 left-6 text-white/30 text-xs font-mono">+</div>
            <div className="absolute bottom-6 right-6 text-white/30 text-xs font-mono">+</div>

            <div className="max-w-7xl mx-auto w-full relative z-10">

                {/* Top Row: Brand & Hackathon Tag */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-12 border-b border-white/15 gap-6">
                    <div>
                        <div className="text-3xl sm:text-4xl font-black tracking-tighter uppercase font-sans text-white">
                            FIT CLOTH<span className="text-xs align-super font-light">®</span>
                        </div>
                        <p className="text-xs font-mono text-neutral-400 mt-2 uppercase tracking-wider max-w-md">
                            Fashion, understood personally. AI-powered proportion estimation & bespoke fit intelligence.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 bg-neutral-900 border border-white/20 px-4 py-2 rounded-sm text-xs font-mono uppercase tracking-widest text-neutral-300">
                        <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                        <span>HACKATHON // HACKTOBERFEST</span>
                    </div>
                </div>

                {/* Main Columns Grid */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-10 py-12 border-b border-white/15">

                    {/* Column 1: Team GoldX (5 cols) */}
                    <div className="md:col-span-5 space-y-4">
                        <div className="text-[11px] font-mono font-bold tracking-widest uppercase text-neutral-500">
                            [ TEAM // GOLDX ]
                        </div>
                        <h4 className="text-xl font-bold uppercase tracking-tight text-white">
                            THE CREATORS
                        </h4>
                        <ul className="space-y-2 text-xs font-mono uppercase text-neutral-300">
                            {teamMembers.map((member, index) => (
                                <li key={index} className="flex items-center gap-2">
                                    <span className="text-neutral-600">0{index + 1}.</span>
                                    <span className="text-neutral-400">
                                        {member}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Column 2: Leader Connect Links (4 cols) */}
                    <div className="md:col-span-4 space-y-4">
                        <div className="text-[11px] font-mono font-bold tracking-widest uppercase text-neutral-500">
                            [ LEADERSHIP // CONNECT ]
                        </div>
                        <h4 className="text-xl font-bold uppercase tracking-tight text-white">
                            HAIDER S VADGAMWALA
                        </h4>
                        <div className="flex flex-col space-y-2 text-xs font-mono uppercase">
                            {leaderLinks.map((link, idx) => (
                                <a
                                    key={idx}
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-neutral-400 hover:text-white hover:underline transition-colors flex items-center gap-1.5 w-fit"
                                >
                                    <span>→</span>
                                    <span>{link.label}</span>
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Column 3: Philosophy Stamp (3 cols) */}
                    <div className="md:col-span-3 flex flex-col justify-between p-6 bg-neutral-900/80 border border-white/10 rounded-sm">
                        <div>
                            <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 block mb-2">
                // MANIFESTO
                            </span>
                            <p className="font-editorial italic text-lg text-neutral-300 leading-snug">
                                "No one-size-fits-all thinking. Just a personal approach to fit."
                            </p>
                        </div>
                        <div className="mt-6 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
                            BUILD // 2026.10
                        </div>
                    </div>

                </div>

                {/* Bottom Bar */}
                <div className="pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                    <div>© {new Date().getFullYear()} FIT CLOTH • BUILT BY TEAM GOLDX FOR HACKTOBERFEST</div>
                    <div className="flex items-center gap-4">
                        <span>YOUR BODY</span>
                        <span>//</span>
                        <span>YOUR FIT</span>
                        <span>//</span>
                        <span>YOUR RULES</span>
                    </div>
                </div>

            </div>
        </footer>
    );
};

export default Footer;