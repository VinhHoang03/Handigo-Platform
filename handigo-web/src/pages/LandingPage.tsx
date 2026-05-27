import { useEffect, useState } from 'react';
import {
  CategoriesSection,
  FeaturesSection,
  HeroSection,
  HomeFooter,
  LandingNav,
  ProvidersSection,
  StatsSection,
  TestimonialsSection,
} from '../components/home';

const LandingPage = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="bg-surface text-on-surface selection:bg-primary-container selection:text-on-primary-container min-h-screen">
      <LandingNav isScrolled={isScrolled} />
      <main className="pt-32 pb-xl">
        <HeroSection />
        <CategoriesSection />
        <ProvidersSection />
        <FeaturesSection />
        <StatsSection />
        <TestimonialsSection />
      </main>
      <HomeFooter />
    </div>
  );
};

export default LandingPage;
