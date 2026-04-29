import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-white/5 py-12 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
        <div>
          <div className="text-xl font-bold tracking-tighter mb-2">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-indigo-500">
              FinScore PME
            </span>
          </div>
          <p className="text-gray-500 text-sm">
            Empowering the next generation of Tunisian industrial growth.
          </p>
        </div>
        
        <div className="flex gap-8 text-sm text-gray-400">
          <Link href="#" className="hover:text-teal-400 transition-colors">Privacy</Link>
          <Link href="#" className="hover:text-teal-400 transition-colors">Terms</Link>
          <Link href="#" className="hover:text-teal-400 transition-colors">Contact</Link>
        </div>
        
        <div className="text-gray-600 text-xs">
          © 2026 FinScore PME. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
