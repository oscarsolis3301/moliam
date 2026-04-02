"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const footerLinks = {
  company: [
    { href: "/about", label: "About" },
    { href: "/careers", label: "Careers" },
    { href: "/blog", label: "Blog" },
  ],
  services: [
    { href: "/services#content-creation", label: "Content Creation" },
    { href: "/services#social-strategy", label: "Social Strategy" },
    { href: "/services#paid-ads", label: "Paid Ads" },
    { href: "/services#ai-automation", label: "AI Automation" },
  ],
  legal: [
    { href: "/privacy", label: "Privacy Policy" },
    { href: "/terms", label: "Terms of Service" },
  ],
};

const socialLinks = [
  { name: "Twitter", url: "https://twitter.com", icon: "M8 22L19.43 11.57A1.6 1.6 0 0018.33 8.57l-3.33-3.33a1.6 1.6 0 00-2.26 0L4.94 13.27a1.6 1.6 0 00-.55 1.91L8 22z" },
  { name: "LinkedIn", url: "https://linkedin.com", icon: "M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2h-2a2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z" },
  { name: "Instagram", url: "https://instagram.com", icon: "M12 2c3.31 0 6 .67 6 6v9a6 6 0 01-6 6h-6a6 6 0 01-6-6V8a6 6 0 016-6zm0 2a4 4 0 00-4 4v9a4 4 0 004 4h6a4 4 0 004-4v-9a4 4 0 00-4-4zm5 3.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM12 7a5 5 0 015 5v1a5 5 0 01-5 5h-4a5 5 0 01-5-5v-1a5 5 0 015-5h4z" },
];

export default function Footer() {
  return (
    <footer className="glass-nav mt-32">
       <div className="max-w-7xl mx-auto px-6 py-16">
         <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
           {/* Brand Column */}
            <div className="md:col-span-1">
               <h3 className="text-2xl font-bold bg-gradient-accent bg-clip-text text-transparent mb-6">MOLIAMA</h3>
                <p className="text-text-secondary text-sm leading-relaxed mb-6 max-w-xs">
                 AI-powered social media marketing agency transforming brands through data-driven strategies and creative excellence.
                </p>
                 {/* Social Icons */}
                  <div className="flex space-x-4">
                    {socialLinks.map((social, index) => (
                      <motion.a
                       key={social.name}
                       href={social.url}
                       target="_blank"
                       rel="noopener noreferrer"
                       initial={{ opacity: 0, y: 10 }}
                       animate={{ opacity: 1, y: 0 }}
                       transition={{ duration: 0.3, delay: index * 0.1 }}
                       className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                      >
                        <svg className="w-5 h-5 text-text-secondary hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24">
                          <path d={social.icon} />
                        </svg>
                      </motion.a>
                    ))}
                  </div>
            </div>

           {/* Company Links */}
            <div>
               <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-6">Company</h4>
                 <ul className="space-y-3">
                   {footerLinks.company.map((link, index) => (
                     <li key={link.label}>
                       <Link href={link.href} className="text-text-secondary hover:text-white text-sm transition-colors">
                        {link.label}
                      </Link>
                     </li>
                   ))}
                </ul>
            </div>

           {/* Services Links */}
            <div>
               <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-6">Services</h4>
                 <ul className="space-y-3">
                   {footerLinks.services.map((link, index) => (
                     <li key={link.label}>
                       <Link href={link.href} className="text-text-secondary hover:text-white text-sm transition-colors">
                        {link.label}
                      </Link>
                     </li>
                   ))}
                </ul>
            </div>

           {/* Legal */}
            <div>
               <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-6">Legal</h4>
                 <ul className="space-y-3">
                   {footerLinks.legal.map((link, index) => (
                     <li key={link.label}>
                       <Link href={link.href} className="text-text-secondary hover:text-white text-sm transition-colors">
                        {link.label}
                      </Link>
                     </li>
                   ))}
                </ul>
            </div>
         </div>

         {/* Bottom Bar */}
          <div className="mt-16 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-text-muted text-xs">© 2026 MOLIAMA. All rights reserved.</p>
            <motion.div
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             transition={{ duration: 0.5, delay: 0.3 }}
             className="flex items-center space-x-2 text-xs"
            >
               <span className="text-text-secondary">Built with</span>
                <span className="text-accent font-semibold">♥ by MOLIAMA</span>
            </motion.div>
          </div>
       </div>
     </footer>
   );
}
