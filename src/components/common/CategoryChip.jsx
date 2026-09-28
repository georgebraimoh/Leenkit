import React from 'react';
import { motion } from 'framer-motion';

export default function CategoryChip({ label, active, onClick, count, emoji }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.95 }}
      className={`relative px-4 py-2 rounded-full text-xs font-bold tracking-wide whitespace-nowrap transition-colors duration-200 cursor-pointer flex items-center gap-1.5 pressable ${
        active
          ? 'text-white shadow-sm'
          : 'bg-white border border-[#EFE8DB] text-[#6F6F6F] hover:text-[#171717] hover:border-[#171717]/30'
      }`}
    >
      {active && (
        <motion.div
          layoutId="activeCategoryBg"
          className="absolute inset-0 bg-[#18A999] rounded-full -z-0"
          transition={{ type: "spring", stiffness: 450, damping: 32 }}
        />
      )}
      {emoji && <span className="relative z-10 text-sm">{emoji}</span>}
      <span className="relative z-10">{label}</span>
      {count !== undefined && (
        <span
          className={`relative z-10 px-1.5 py-0.5 rounded-full text-[10px] ${
            active ? 'bg-white/20 text-white' : 'bg-[#F4EFE6] text-[#171717]'
          }`}
        >
          {count}
        </span>
      )}
    </motion.button>
  );
}
