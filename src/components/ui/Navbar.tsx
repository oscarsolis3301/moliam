"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/services", label: "Services" },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
  ];

  return (
    <>
      {/* Glass Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "glass-nav py-4" : "py-6"}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 group">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="text-2xl font-bold bg-gradient-accent bg-clip-text text-transparent group-hover:opacity-80 transition-opacity"
            >
              MOLIAMA
            </motion.div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link, index) => (
              <motion.div
                 key={link.href}
                 initial={{ opacity: 0, y: -10 }}
                 animate={{ opacity: 1, y: 0 }}
                 transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                 <Link
                   href={link.href}
                   className="text-text-secondary hover:text-white transition-colors duration-200 text-sm font-medium"
                 >
                   {link.label}
                 </Link>
               </motion.div>
            ))}
             {/* CTA Button */}
             <motion.button
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               transition={{ duration: 0.3, delay: 0.4 }}
               className="px-5 py-2.5 rounded-lg bg-gradient-accent text-white font-medium text-sm hover:opacity-80 transition-opacity shadow-glow"
             >
               Start a Project
             </motion.button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Toggle menu"
          >
             <svg
               className="w-6 h-6 text-white"
               fill="none"
               stroke="currentColor"
               viewBox="0 0 24 24"
             >
               {isOpen ? (
                 <path
                   strokeLinecap="round"
                   strokeLinejoin="round"
                   strokeWidth={2}
                   d="M6 18L18 6M6 6l12 12"
                 />
               ) : (
                 <path
                   strokeLinecap="round"
                   strokeLinejoin="round"
                   strokeWidth={2}
                   d="M4 6h16M4 12h16M4 18h16"
                 />
               )}
             </svg>
          </button>
        </div>

        {/* Full-screen Mobile Menu */}
         <AnimatePresence>
           {isOpen && (
             <motion.div
               initial={{ opacity: 0, height: 0 }}
               animate={{ opacity: 1, height: "100vh" }}
               exit={{ opacity: 0, height: 0 }}
               transition={{ duration: 0.4 }}
               className="md:hidden glass-nav absolute top-0 left-0 right-0 overflow-hidden"
             >
               <div className="flex flex-col h-full justify-center items-center space-y-8 px-6">
                 {navLinks.map((link, index) => (
                   <motion.div
                     key={link.href}
                     initial={{ opacity: 0, x: 20 }}
                     animate={{ opacity: 1, x: 0 }}
                     transition={{ duration: 0.3, delay: index * 0.1 }}
                   >
                     <Link
                       href={link.href}
                       onClick={() => setIsOpen(false)}
                       className="text-2xl font-medium text-text-secondary hover:text-white transition-colors block"
                     >
                       {link.label}
                     </Link>
                   </motion.div>
                 ))}
                  {/* Mobile CTA */}
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.5 }}
                    className="mt-8 px-8 py-3 rounded-lg bg-gradient-accent text-white font-medium shadow-glow"
                  >
                    Start a Project
                  </motion.button>
               </div>
             </motion.div>
           )}
         </AnimatePresence>
      </nav>

      {/* Spacer for fixed nav */}
      <div className="h-20"></div>
    </>
  );
}
