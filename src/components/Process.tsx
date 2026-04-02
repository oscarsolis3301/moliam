"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const steps = [
   { number: "01", title: "Discovery", description: "We dive deep into your brand, audience, and goals to create a strategic foundation." },
  { number: "02", title: "Strategy", description: "AI-powered research informs our custom approach for maximum impact." },
    { number: "03", title: "Create", description: "Our team produces polished content with AI enhancement for consistency and scale." },
      { number: "04", title: "Launch", description: "Strategic deployment across your target platforms with real-time optimization." },
        { number: "05", title: "Optimize", description: "Continuous iteration based on data insights and performance metrics." },
];

export default function Process() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
     target: containerRef,
     offset: ["start end", "end start"],
    });

  const opacity = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.8, 1]);

  return (
    <section id="process" ref={containerRef} className="py-32 px-6 bg-moliama-dark">
         <div className="max-w-7xl mx-auto">
            {/* Section Header */}
            <motion.div
             initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.6 }}
                className="text-center mb-16"
                >
                <h2 className="text-4xl md:text-5xl font-bold mb-6">Our Process</h2>
                 <p className="text-xl text-text-secondary max-w-2xl mx-auto">
                   Five steps that turn your vision into viral results.
                  </p>
               </motion.div>

            {/* Horizontal Stepper */}
             <div className="relative">
                {/* Connection Line (Desktop) */}
                 <div className="hidden md:block absolute top-12 left-0 right-0 h-0.5 bg-gradient-accent opacity-30" />

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
                    {steps.map((step, index) => (
                       <motion.div
                        key={step.number}
                         initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                           transition={{ duration: 0.5, delay: index * 0.1 }}
                            className="relative"
                            >
                          {/* Step Number */}
                           <div className="text-6xl font-bold text-accent/20 mb-4">{step.number}</div>

                            {/* Content Card */}
                             <div className="p-6 rounded-xl bg-surface-1 border border-white/5 hover:border-accent/30 transition-all duration-300">
                               <h3 className="text-lg font-semibold mb-2 group-hover:text-accent transition-colors">{step.title}</h3>
                                <p className="text-text-secondary text-sm">{step.description}</p>
                             </div>

                              {/* Connector (Desktop) */}
                               {index < steps.length - 1 && (
                                <div className="hidden md:block absolute top-12 -right-1/2 w-1/2 h-0.5 bg-gradient-to-r from-accent to-transparent opacity-20" />
                               )}
                           </motion.div>
                        ))}
                      </div>
                 </div>

            {/* Process CTA */}
             <motion.div
              initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
                 className="mt-16 text-center"
                 >
                  <p className="text-text-secondary mb-6">Want to experience our process firsthand?</p>
                   <a href="/contact" className="text-accent hover:text-accent-hover font-medium underline">
                     Start your project →
                    </a>
                 </motion.div>
            </div>
       </section>
     );
}
