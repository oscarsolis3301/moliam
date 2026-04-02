"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

const testimonials = [
   {
     quote: "MOLIAMA transformed how we connect with our audience. Our engagement doubled in 90 days.",
      author: "Sarah Chen",
       role: "CMO, TechFlow",
        avatar: "👩‍💼",
         },
          {
          quote: "The AI-powered insights helped us cut waste and focus on what actually moves the needle. Worth every penny.",
           author: "Marcus Johnson",
            role: "Marketing Director, RetailCo",
             avatar: "👨‍💼",
              },
               {
               quote: "Their creative team gets it. Finally an agency that balances data with actual creativity.",
                author: "Emily Rodriguez",
                 role: "Brand Manager, StyleHub",
                  avatar: "👩‍🎨",
                   },
                    {
                    quote: "We've tested every agency in the space. MOLIAMA is the only one that delivers consistent results.",
                     author: "David Kim",
                      role: "Founder, GrowthLabs",
                       avatar: "👨‍🚀",
                        },
                         {
                         quote: "The AI automation suite they built for us saved 20 hours per week. Game-changing.",
                          author: "Amanda Foster",
                           role: "Operations Lead, ConnectPro",
                            avatar: "👩‍💻",
                             },
                              {
                              quote: "Our TikTok went viral thanks to their strategy. 5M views in the first campaign. Incredible.",
                               author: "Jake Martinez",
                                role: "Social Manager, WaveBrand",
                                 avatar: "👨‍🎤",
                                  },
];

export default function Testimonials() {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <section id="testimonials" className="py-32 px-6 bg-moliama-dark">
         <div className="max-w-7xl mx-auto">
              {/* Section Header */}
               <motion.div
               initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                 transition={{ duration: 0.6 }}
                  className="text-center mb-16"
                    >
                      <h2 className="text-4xl md:text-5xl font-bold mb-6">What Clients Say</h2>
                       <p className="text-xl text-text-secondary max-w-2xl mx-auto">
                        Real results. Real partners. Real stories.
                       </p>
                     </motion.div>

                   {/* Testimonial Cards */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {testimonials.map((testimonial, index) => (
                        <motion.div
                        key={testimonial.author}
                         initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                           transition={{ duration: 0.5, delay: index * 0.1 }}
                            className="group p-8 rounded-xl bg-surface-1 border border-white/5 hover:border-accent/30 transition-all duration-300"
                              >
                             {/* Quote Icon */}
                              <div className="text-4xl text-accent/20 mb-6">"</div>

                               {/* Quote */}
                                <p className="text-xl leading-relaxed mb-8 italic">{testimonial.quote}</p>

                                 {/* Author */}
                                  <div className="flex items-center space-x-4">
                                   <div className="w-12 h-12 rounded-full bg-gradient-accent flex items-center justify-center text-2xl">
                                     {testimonial.avatar}
                                    </div>
                                     <div>
                                       <div className="font-semibold">{testimonial.author}</div>
                                        <div className="text-text-secondary text-sm">{testimonial.role}</div>
                                      </div>
                                    </div>

                                   {/* Hover Effect */}
                                    <div className="absolute inset-0 rounded-xl bg-gradient-accent/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                  </motion.div>
                              ))}
                           </div>

                         {/* CTA */}
                          <motion.div
                          initial={{ opacity: 0, y: 20 }}
                           animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.8 }}
                             className="mt-16 text-center"
                              >
                               <p className="text-text-secondary mb-6">Want to be our next success story?</p>
                                <a href="/contact" className="text-accent hover:text-accent-hover font-medium underline">
                                 Start your journey →
                                </a>
                              </motion.div>
                            </div>
                          </section>
                        );
                      }
