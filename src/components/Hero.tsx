"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function Hero() {
  const words = ["Transform", "Your", "Brand", "With", "AI-Powered", "Marketing"];

  const container = {
    hidden: { opacity: 0 },
    show: {
       opacity: 1,
       transition: { staggerChildren: 0.1, delayChildren: 0.2 },
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
    <section className="relative min-h-[calc(100vh-80px)] flex items-center justify-center overflow-hidden">
       {/* Animated Background Gradient Mesh */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
           <div className="absolute w-[600px] h-[600px] rounded-full bg-gradient-accent/20 blur-[120px] animate-pulse" />
           <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-accent/10 blur-[80px]" />
           <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-pink-500/10 blur-[100px]" />
        </div>

        {/* Content */}
        <div className="relative max-w-7xl mx-auto px-6 text-center z-10">
          <motion.h1
           className="text-5xl md:text-7xl lg:text-8xl font-bold leading-tight mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
           >
             <motion.div
               className="flex flex-wrap justify-center items-center gap-x-2 gap-y-1"
               variants={container}
               initial="hidden"
               animate="show"
             >
                {words.map((word, index) => (
                  <motion.span key={index} variants={item} className="bg-gradient-accent bg-clip-text text-transparent">
                    {word}
                  </motion.span>
                 ))}
            </motion.div>
           </motion.h1>

          <motion.p
           initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1 }}
            className="text-xl md:text-2xl text-text-secondary mb-10 max-w-3xl mx-auto leading-relaxed"
           >
             Transform your brand with AI-powered marketing that actually works. We combine data-driven strategies with creative excellence to scale your presence.
          </motion.p>

          <motion.div
           initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
           >
             <Link href="/#services">
               <motion.button
                 whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-4 rounded-lg bg-white text-black font-semibold text-lg hover:bg-gray-100 transition-colors shadow-premium"
               >
                 See Our Work
                </motion.button>
             </Link>
             <Link href="/contact">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                   whileTap={{ scale: 0.95 }}
                    className="px-8 py-4 rounded-lg bg-gradient-accent text-white font-semibold text-lg hover:opacity-90 transition-opacity shadow-glow"
                 >
                   Start a Project
                  </motion.button>
              </Link>
           </motion.div>

          {/* Background Glow */}
            <div className="absolute inset-0 -z-10">
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-glow" />
            </div>
        </div>
     </section>
   );
}
