"use client";

import { motion } from "framer-motion";

export default function Home() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative min-h-[calc(100vh-64px)] flex items-center justify-center overflow-hidden">
        {/* Animated Gradient Background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900" />
          <motion.div
            className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-brand-500/10 blur-[120px]"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.1, 0.2, 0.1],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-brand-500/15 blur-[100px]"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.15, 0.25, 0.15],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          {/* Animated Text Reveal */}
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-display-xl sm:text-6xl font-bold tracking-tight text-white mb-6"
          >
            {["Elevate", "Your", "Brand"].map((word, i) => (
              <motion.span
                 key={i}
                 className="inline-block mr-2 last:mr-0"
                 initial={{ opacity: 0, y: 40 }}
                 animate={{ opacity: 1, y: 0 }}
                 transition={{ delay: i * 0.15 + 0.3, duration: 0.5, ease: "easeOut" }}
               >
                 {word}
                 <span className="text-brand-500">{i === 2 ? "!" : "."}</span>
               </motion.span>
             ))}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7, ease: "easeOut" }}
            className="text-xl text-neutral-300 mb-8 max-w-2xl mx-auto font-light leading-relaxed"
          >
            Transform your brand with AI-powered marketing that actually works. We combine cutting-edge technology with creative excellence to deliver measurable results.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.9, ease: "easeOut" }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <a href="#contact" className="w-full sm:w-auto px-8 py-3 text-base font-semibold text-white bg-brand-500 rounded-lg hover:bg-brand-600 transition-all shadow-glow transform hover:scale-105">
              Start a Project
            </a>
            <a href="#services" className="w-full sm:w-auto px-8 py-3 text-base font-semibold text-neutral-200 bg-dark-700 rounded-lg hover:bg-dark-600 transition-all border border-dark-600">
              See Our Work
            </a>
          </motion.div>

          {/* Social Proof Bar */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.1, ease: "easeOut" }}
            className="mt-16 pt-8 border-t border-dark-600/50 max-w-4xl mx-auto"
          >
            <div className="grid grid-cols-3 gap-8">
              {[
                { value: "50+", label: "Brands Scaled" },
               { value: "2M+", label: "Impressions Generated" },
               { value: "100%", label: "AI-First Agency" },
             ].map((stat, i) => (
                <motion.div key={i} className="text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.3 + i * 0.1 }}>
                   <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
                   <div className="text-sm text-neutral-400 font-light">{stat.label}</div>
                 </motion.div>
               ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-34 bg-dark-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
            <h2 className="text-display-md text-center mb-4">Comprehensive Marketing Solutions</h2>
            <p className="text-xl text-neutral-300 text-center mb-16 max-w-2xl mx-auto font-light">
              From strategy to execution, we've got your brand covered with cutting-edge AI technology.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Content Creation */}
              <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} whileHover={{ scale: 1.02 }} className="bg-dark-700 rounded-premium-xl border border-dark-600 p-8 hover:border-brand-500/50 transition-all group">
                <div className="w-14 h-14 rounded-lg bg-brand-500/10 flex items-center justify-center mb-6 group-hover:bg-brand-500/20 transition-all">
                  <svg className="w-8 h-8 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036 5.172L15 8.414V3a1 1 0 00-1-1h-2a1 1 0 00-1 1v5.414l-1.732 1.732a1 1 0 001.414 1.414L10 8.414V3a1 1 0 00-1-1H7a1 1 0 00-1 1v5.414l-1.732 1.732a1 1 0 001.414 1.414L8 8.414V3a1 1 0 00-1-1H5a1 1 0 00-1 1v5.414L2 12.76A1 1 0 002 15v4a1 1 0 001 1h2a1 1 0 001-1v-2.24l2.88-1.344L13.37 9.44l-.37 2.64 1.44.672V15a1 1 0 001 1h4a1 1 0 001-1v-4a1 1 0 00-1-1h-2.37L16.88 12z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Content Creation</h3>
                <p className="text-neutral-300 font-light leading-relaxed">
                  AI-driven content that speaks directly to your audience. Copy, graphics, video—everything crafted for maximum impact.
                </p>
              </motion.div>

              {/* Social Strategy */}
              <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} whileHover={{ scale: 1.02 }} className="bg-dark-700 rounded-premium-xl border border-dark-600 p-8 hover:border-brand-500/50 transition-all group">
                <div className="w-14 h-14 rounded-lg bg-brand-500/10 flex items-center justify-center mb-6 group-hover:bg-brand-500/20 transition-all">
                  <svg className="w-8 h-8 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Social Strategy</h3>
                <p className="text-neutral-300 font-light leading-relaxed">
                  Platform-specific strategies that build genuine communities and drive authentic engagement with your target audience.
                </p>
              </motion.div>

              {/* Paid Ads Management */}
              <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} whileHover={{ scale: 1.02 }} className="bg-dark-700 rounded-premium-xl border border-dark-600 p-8 hover:border-brand-500/50 transition-all group">
                <div className="w-14 h-14 rounded-lg bg-brand-500/10 flex items-center justify-center mb-6 group-hover:bg-brand-500/20 transition-all">
                  <svg className="w-8 h-8 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Paid Ads Management</h3>
                <p className="text-neutral-300 font-light leading-relaxed">
                  Precision-targeted campaigns that convert. ROI-focused advertising across all major platforms with continuous optimization.
                </p>
              </motion.div>

              {/* AI Automation */}
              <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} whileHover={{ scale: 1.02 }} className="bg-dark-700 rounded-premium-xl border border-dark-600 p-8 hover:border-brand-500/50 transition-all group">
                <div className="w-14 h-14 rounded-lg bg-brand-500/10 flex items-center justify-center mb-6 group-hover:bg-brand-500/20 transition-all">
                  <svg className="w-8 h-8 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">AI Automation</h3>
                <p className="text-neutral-300 font-light leading-relaxed">
                  Streamline your marketing operations with intelligent workflows that save time and boost efficiency.
                </p>
              </motion.div>

              {/* Brand Identity */}
              <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} whileHover={{ scale: 1.02 }} className="bg-dark-700 rounded-premium-xl border border-dark-600 p-8 hover:border-brand-500/50 transition-all group">
                <div className="w-14 h-14 rounded-lg bg-brand-500/10 flex items-center justify-center mb-6 group-hover:bg-brand-500/20 transition-all">
                  <svg className="w-8 h-8 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Brand Identity</h3>
                <p className="text-neutral-300 font-light leading-relaxed">
                  Visual systems that make your brand unforgettable. Logo design, typography, color theory—all crafted for impact.
                </p>
              </motion.div>

              {/* Analytics & Reporting */}
              <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} whileHover={{ scale: 1.02 }} className="bg-dark-700 rounded-premium-xl border border-dark-600 p-8 hover:border-brand-500/50 transition-all group">
                <div className="w-14 h-14 rounded-lg bg-brand-500/10 flex items-center justify-center mb-6 group-hover:bg-brand-500/20 transition-all">
                  <svg className="w-8 h-8 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Analytics &amp; Reporting</h3>
                <p className="text-neutral-300 font-light leading-relaxed">
                  Data-driven insights that guide decisions. Custom dashboards and real-time reporting for transparent performance tracking.
                </p>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Process Section */}
      <section id="process" className="py-34 bg-dark-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
            <h2 className="text-display-md text-center mb-4">Our Process</h2>
            <p className="text-xl text-neutral-300 text-center mb-16 max-w-2xl mx-auto font-light">
              A proven methodology that takes your brand from concept to category leader.
            </p>

            <div className="relative">
               {/* Horizontal line */}
              <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-gradient-to-r from-brand-500 via-brand-400 to-brand-500 hidden lg:block" />

              <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
                {/* Step 1 */}
                <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-center relative z-10">
                  <div className="w-16 h-16 rounded-full bg-dark-700 border-2 border-brand-500 mx-auto mb-4 flex items-center justify-center shadow-glow">
                    <span className="text-lg font-bold text-white">1</span>
                  </div>
                  <h3 className="font-semibold text-white mb-2">Discovery</h3>
                  <p className="text-sm text-neutral-300">We dive deep into your brand, audience, and goals to build a strategic foundation.</p>
                </motion.div>

                {/* Step 2 */}
                <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-center relative z-10">
                  <div className="w-16 h-16 rounded-full bg-dark-700 border-2 border-brand-500 mx-auto mb-4 flex items-center justify-center shadow-glow">
                    <span className="text-lg font-bold text-white">2</span>
                  </div>
                  <h3 className="font-semibold text-white mb-2">Strategy</h3>
                  <p className="text-sm text-neutral-300">Data-backed strategy that aligns with your objectives and audience insights.</p>
                </motion.div>

                {/* Step 3 */}
                <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-center relative z-10">
                  <div className="w-16 h-16 rounded-full bg-dark-700 border-2 border-brand-500 mx-auto mb-4 flex items-center justify-center shadow-glow">
                    <span className="text-lg font-bold text-white">3</span>
                  </div>
                  <h3 className="font-semibold text-white mb-2">Create</h3>
                  <p className="text-sm text-neutral-300">Crafting content and campaigns with AI-powered precision and human creativity.</p>
                </motion.div>

                {/* Step 4 */}
                <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="text-center relative z-10">
                  <div className="w-16 h-16 rounded-full bg-dark-700 border-2 border-brand-500 mx-auto mb-4 flex items-center justify-center shadow-glow">
                    <span className="text-lg font-bold text-white">4</span>
                  </div>
                  <h3 className="font-semibold text-white mb-2">Launch</h3>
                  <p className="text-sm text-neutral-300">Executing campaigns across multiple channels with optimized targeting.</p>
                </motion.div>

                {/* Step 5 */}
                <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="text-center relative z-10">
                  <div className="w-16 h-16 rounded-full bg-dark-700 border-2 border-brand-500 mx-auto mb-4 flex items-center justify-center shadow-glow">
                    <span className="text-lg font-bold text-white">5</span>
                  </div>
                  <h3 className="font-semibold text-white mb-2">Optimize</h3>
                  <p className="text-sm text-neutral-300">Continuous monitoring and refinement to maximize ROI and performance.</p>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-34 bg-dark-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
            <h2 className="text-display-md text-center mb-4">What Clients Say</h2>
            <p className="text-xl text-neutral-300 text-center mb-16 max-w-2xl mx-auto font-light">
              Real results from brands that transformed their presence with MOLIAMA.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Testimonial 1 */}
                <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="bg-dark-700 rounded-premium-xl border border-dark-600 p-8">
                  <div className="flex items-center mb-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                       <svg key={star} className="w-5 h-5 text-brand-500" fill="currentColor" viewBox="0 0 20 20">
                         <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                       </svg>
                     ))}
                  </div>
                  <p className="text-neutral-300 mb-6 italic">"MOLIAMA transformed our social media presence entirely. Our engagement increased 340% in just three months, and our brand recognition is through the roof."</p>
                  <div>
                    <p className="font-semibold text-white">Sarah Chen</p>
                    <p className="text-sm text-neutral-400">CMO at TechFlow Inc.</p>
                  </div>
                </motion.div>

                {/* Testimonial 2 */}
                <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="bg-dark-700 rounded-premium-xl border border-dark-600 p-8">
                  <div className="flex items-center mb-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                       <svg key={star} className="w-5 h-5 text-brand-500" fill="currentColor" viewBox="0 0 20 20">
                         <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                       </svg>
                     ))}
                  </div>
                  <p className="text-neutral-300 mb-6 italic">"The AI-powered approach they use is game-changing. Our ad spend ROI improved by 285% while we cut campaign setup time in half."</p>
                  <div>
                    <p className="font-semibold text-white">Marcus Rodriguez</p>
                    <p className="text-sm text-neutral-400">Founder at GreenEats</p>
                  </div>
                </motion.div>

                {/* Testimonial 3 */}
                <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} className="bg-dark-700 rounded-premium-xl border border-dark-600 p-8">
                  <div className="flex items-center mb-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                       <svg key={star} className="w-5 h-5 text-brand-500" fill="currentColor" viewBox="0 0 20 20">
                         <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                       </svg>
                     ))}
                  </div>
                  <p className="text-neutral-300 mb-6 italic">"Professional, data-driven, and incredibly creative. They don't just deliver results—they redefine what's possible for your brand."</p>
                  <div>
                    <p className="font-semibold text-white">Jennifer Park</p>
                    <p className="text-sm text-neutral-400">Marketing Director at StyleHub</p>
                  </div>
                </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section id="contact" className="py-34 bg-dark-800 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-dark-900 via-brand-500/5 to-dark-900" />
        
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-display-lg text-white mb-6">Ready to Transform Your Brand?</h2>
            <p className="text-xl text-neutral-300 mb-10 max-w-2xl mx-auto font-light">
              Join 50+ brands that scaled their presence with MOLIAMA. Book a free consultation and discover your potential.
            </p>
            
            <a href="#" className="inline-flex items-center px-10 py-4 text-lg font-bold text-white bg-brand-500 rounded-lg hover:bg-brand-600 transition-all shadow-glow transform hover:scale-105">
              Book Your Free Consultation
              <svg className="w-5 h-5 ml-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>

            <p className="mt-6 text-sm text-neutral-400">No commitment required. Free discovery call with our strategy team.</p>
          </motion.div>
        </div>
      </section>
    </>
  );
}
