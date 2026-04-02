"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function FinalCTA() {
  return (
    <section id="cta" className="relative py-32 px-6 overflow-hidden">
         {/* Background */}
         <div className="absolute inset-0 bg-gradient-premium">
             <div className="absolute inset-0 bg-gradient-accent/10" />
               <div className="absolute w-[800px] h-[800px] rounded-full bg-accent/20 blur-[150px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
             </div>

              {/* Content */}
               <div className="relative max-w-4xl mx-auto text-center">
                 <motion.div
                 initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                   transition={{ duration: 0.6 }}
                    className="space-y-8"
                     >
                      <h2 className="text-4xl md:text-6xl font-bold">
                        Ready to Transform Your Brand?
                       </h2>

                       <p className="text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed">
                        Join 50+ brands that scaled with MOLIAMA. Let's build something extraordinary together.
                       </p>

                       {/* CTA Buttons */}
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
                          <Link href="/contact">
                            <motion.button
                             whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                               className="px-10 py-5 rounded-xl bg-gradient-accent text-white font-semibold text-lg hover:opacity-90 transition-opacity shadow-glow"
                                >
                              Book a Strategy Call
                            </motion.button>
                          </Link>

                           <Link href="/services">
                             <motion.button
                             whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                               className="px-10 py-5 rounded-xl bg-white text-black font-semibold text-lg hover:bg-gray-100 transition-colors"
                                >
                               View All Services
                             </motion.button>
                           </Link>
                         </div>

                          {/* Social Proof Badge */}
                           <motion.div
                           initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                             transition={{ duration: 0.5, delay: 0.4 }}
                              className="mt-12 flex items-center justify-center space-x-6 text-sm text-text-secondary"
                               >
                             <div className="flex items-center">
                               <svg className="w-5 h-5 mr-2 text-accent" fill="currentColor" viewBox="0 0 24 24">
                                 <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                               </svg>
                                <span>No contracts. Cancel anytime.</span>
                              </div>
                               <div className="flex items-center">
                                <svg className="w-5 h-5 mr-2 text-accent" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                </svg>
                                 <span>Free initial consultation.</span>
                               </div>
                             </motion.div>
                           </motion.div>
                         </div>
                       </section>
                     );
                   }
