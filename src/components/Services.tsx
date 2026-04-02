"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const services = [
   {
     title: "Content Creation",
     description: "AI-enhanced copy, video, and graphics that capture your brand's voice and engage your audience across all platforms.",
     icon: "📝",
    },
   {
     title: "Social Strategy",
     description: "Data-driven content calendars and platform optimization to maximize reach and engagement for your brand.",
     icon: "📊",
    },
   {
     title: "Paid Ads Management",
     description: "Precision-targeted campaigns with AI-optimized bidding and creative testing for maximum ROAS.",
     icon: "🎯",
    },
   {
     title: "AI Automation",
     description: "Custom chatbots, workflow automation, and AI-powered customer engagement systems.",
     icon: "🤖",
    },
   {
     title: "Brand Identity",
     description: "Complete visual rebrands and voice development to position your brand for market leadership.",
     icon: "✨",
    },
   {
     title: "Analytics & Reporting",
     description: "Real-time dashboards and AI-powered insights to measure what matters and optimize performance.",
     icon: "📈",
    },
];

export default function Services() {
  const container = {
     hidden: { opacity: 0 },
     show: {
       opacity: 1,
       transition: { staggerChildren: 0.1 },
      },
    };

  const item = {
     hidden: { opacity: 0, y: 20 },
     show: {
       opacity: 1,
       y: 0,
       transition: { duration: 0.5 },
      },
    };

  return (
    <section id="services" className="py-32 px-6">
         <div className="max-w-7xl mx-auto">
           {/* Section Header */}
            <motion.div
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.6 }}
             className="text-center mb-16"
             >
               <h2 className="text-4xl md:text-5xl font-bold mb-6">Services That Scale</h2>
               <p className="text-xl text-text-secondary max-w-2xl mx-auto">
                 We combine AI technology with creative excellence to deliver measurable results across every touchpoint.
               </p>
             </motion.div>

           {/* Service Cards */}
           <motion.div
            initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             transition={{ duration: 0.6, delay: 0.2 }}
             variants={container}
             className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            >
              {services.map((service, index) => (
               <motion.div
                 key={service.title}
                  variants={item}
                  initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                     className="group p-8 rounded-xl bg-surface-1 border border-white/5 hover:border-accent/50 transition-all duration-300 hover:-translate-y-2"
                   >
                  <div className="text-4xl mb-6">{service.icon}</div>
                    <h3 className="text-xl font-semibold mb-4 group-hover:text-accent transition-colors">{service.title}</h3>
                     <p className="text-text-secondary leading-relaxed mb-6">{service.description}</p>
                      <Link href={`/services#${service.title.toLowerCase().replace(/\s+/g, "-")}`} className="text-accent hover:text-accent-hover font-medium inline-flex items-center group/link">
                       Learn more →
                        <svg className="w-4 h-4 ml-2 transition-transform group-hover/link:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </Link>
                  </motion.div>
               ))}
            </motion.div>

           {/* CTA */}
             <motion.div
              initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
                className="mt-16 text-center"
               >
                 <p className="text-text-secondary mb-6">Ready to elevate your brand?</p>
                  <Link href="/contact">
                    <motion.button
                     whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                       className="px-8 py-4 rounded-lg bg-gradient-accent text-white font-semibold shadow-glow"
                     >
                       Book a Consultation
                     </motion.button>
                   </Link>
                </motion.div>
           </div>
      </section>
    );
}
