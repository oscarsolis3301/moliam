import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

const sora = Sora({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "MOLIAMA | AI-Powered Social Media Marketing Agency",
  description: "Transform your brand with AI-powered marketing that actually works. Content creation, social strategy, paid ads management, and AI automation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable} antialiased`}>
      <body className="min-h-full flex flex-col bg-dark-900 text-neutral-100">
        {/* Sticky Glassmorphic Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl border-b border-dark-600/50 bg-dark-900/80">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <Link href="/" className="flex-shrink-0">
                <span className="text-2xl font-bold text-brand-500 tracking-tight font-display">MOLIAMA</span>
              </Link>

              {/* Desktop Menu */}
              <div className="hidden md:flex items-center space-x-8">
                <a href="#services" className="text-sm font-medium text-neutral-200 hover:text-brand-500 transition-colors">Services</a>
                <a href="#process" className="text-sm font-medium text-neutral-200 hover:text-brand-500 transition-colors">Process</a>
                <a href="#results" className="text-sm font-medium text-neutral-200 hover:text-brand-500 transition-colors">Results</a>
                <Link href="/contact" className="px-4 py-2 text-sm font-semibold text-white bg-brand-500 rounded-lg hover:bg-brand-600 transition-all shadow-glow">Book a Call</Link>
              </div>

              {/* Mobile Menu Button */}
              <MobileMenuButton />
            </div>
          </div>
        </nav>

        {/* Main Content Area - with padding for sticky header */}
        <main className="flex-grow pt-16">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-dark-600 bg-dark-800">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div>
                <h3 className="text-lg font-bold text-brand-500 mb-4">MOLIAMA</h3>
                <p className="text-sm text-neutral-300">AI-powered marketing that scales your brand with precision and creativity.</p>
              </div>
              
              <div>
                <h4 className="font-semibold text-white mb-4">Company</h4>
                <ul className="space-y-2 text-sm">
                  <li><Link href="/about" className="text-neutral-300 hover:text-brand-500 transition-colors">About</Link></li>
                  <li><Link href="/careers" className="text-neutral-300 hover:text-brand-500 transition-colors">Careers</Link></li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-4">Legal</h4>
                <ul className="space-y-2 text-sm">
                  <li><Link href="/privacy" className="text-neutral-300 hover:text-brand-500 transition-colors">Privacy Policy</Link></li>
                  <li><Link href="/terms" className="text-neutral-300 hover:text-brand-500 transition-colors">Terms of Service</Link></li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-4">Connect</h4>
                <div className="flex space-x-4">
                  <a href="#" className="text-neutral-300 hover:text-brand-500 transition-colors">LinkedIn</a>
                  <a href="#" className="text-neutral-300 hover:text-brand-500 transition-colors">Twitter</a>
                  <a href="#" className="text-neutral-300 hover:text-brand-500 transition-colors">Instagram</a>
                </div>
              </div>
            </div>
            
            <div className="mt-12 pt-8 border-t border-dark-600 text-center text-sm text-neutral-300">
              © 2024 MOLIAMA. Built with precision and purpose.
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

function MobileMenuButton() {
  return (
    <button className="md:hidden p-2 text-neutral-200 hover:text-white transition-colors" aria-label="Open menu">
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  );
}
