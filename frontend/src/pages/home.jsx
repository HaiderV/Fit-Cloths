import Hero from "../components/Hero";
import ProblemSection from "../components/ProblemSection";
import TechSection from "../components/TechSection";
import PhilosopySection from "../components/PhilosophySection";
import VisionSection from "../components/VisionSection";

function home() {
    return (
        <>
            <Hero onDiscoverClick={() => document.getElementById('problem')?.scrollIntoView({ behavior: 'smooth' })} />
            <ProblemSection />
            <TechSection />
            <PhilosopySection />
            <VisionSection />
        </>
    )
}

export default home;