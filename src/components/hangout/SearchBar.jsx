import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';

export default function SearchBar({ value, onChange, placeholder = "Search Hangouts by name, place or keyword" }) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <motion.div
      animate={{ scale: isFocused ? 1.008 : 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="relative w-full max-w-xl"
    >
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#6F6F6F]">
        <Search className={`w-5 h-5 transition-colors ${isFocused ? 'text-[#18A999]' : ''}`} />
      </div>
      <input
        type="search"
        aria-label="Search Hangouts"
        value={value}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-11 pr-10 py-3.5 bg-white border border-[#E8E6E1] rounded-full text-sm text-[#171717] placeholder-[#6F6F6F] focus:outline-none focus:ring-2 focus:ring-[#18A999]/30 focus:border-[#18A999] shadow-xs transition-all"
      />
      <AnimatePresence>
        {value && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileTap={{ scale: 0.9 }}
            type="button"
            aria-label="Clear search"
            onClick={() => onChange('')}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#6F6F6F] hover:text-[#171717] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
