"use client";

import { motion } from "framer-motion";

const caseStudies = [
   {
     metric: "+285%",
     label: "Instagram Engagement",
     client: "Tech Startup",
     description: "AI-driven content strategy for B2B SaaS company.",
     },
   {
     metric: "10M+",
     label: "Social Impressions Generated",
     client: "E-commerce Brand",
     description: "Full-funnel social media campaign across platforms.",
     },
     {
      metric: "+420%",
       label: "TikTok Followers (90 Days)",
        client: "Lifestyle Brand",
         description: "Viral content strategy with AI-optimized posting times.",
          },
           {
            metric: "5.2x",
             label: "ROAS on Paid Campaigns",
              client: "DTC Brand",
               description: "Multi-channel paid social advertising optimization.",
                },
                  {
                   metric: "300%",
                    label: "LinkedIn Lead Generation",
                     client: "Enterprise Software",
                      description: "ABM strategy with AI-personalized content.",
                       },
                        {
                         metric: "15M+",
                          label: "TikTok Video Views",
                           client: "Food & Beverage",
                            description: "Creator collaboration program with predictive analytics.",
                             },
];

export default function Results() {
  return (
    <section id="results" className="py-32 px-6">
         <div className="max-w-7xl mx-auto">
             {/* Section Header */}
              <motion.div
               initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                 transition={{ duration: 0.6 }}
                  className="text-center mb-16"
                   >
                    <h2 className="text-4xl md:text-5xl font-bold mb-6">Real Results</h2>
                     <p className="text-xl text-text-secondary max-w-2xl mx-auto">
                      Numbers don't lie. Here's what we've achieved for our clients.
                     </p>
                    </motion.div>

                  {/* Bento Grid */}
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     {caseStudies.map((study, index) => (
                       <motion.div
                        key={study.client}
                         initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                           transition={{ duration: 0.5, delay: index * 0.1 }}
                            className="group p-8 rounded-xl bg-surface-1 border border-white/5 hover:border-accent/30 transition-all duration-300"
                             >
                          {/* Metric */}
                           <div className="text-5xl md:text-6xl font-bold bg-gradient-accent bg-clip-text text-transparent mb-4">{study.metric}</div>

                           {/* Label & Client */}
                            <h3 className="text-xl font-semibold mb-2">{study.label}</h3>
                             <p className="text-accent text-sm mb-4">for {study.client}</p>

                              {/* Description */}
                               <p className="text-text-secondary text-sm leading-relaxed">{study.description}</p>

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
                            <p className="text-text-secondary mb-6">Ready to add your results here?</p>
                             <a href="/contact" className="text-accent hover:text-accent-hover font-medium underline">
                              Book a Strategy Call →
                             </a>
                            </motion.div>
                           </div>
                         </section>
                       );
                     }
