import {
  Sparkles,
  Utensils,
  Music,
  Trophy,
  Gamepad2,
  Camera,
  Film,
  Palette,
  Code,
  Compass,
  Zap
} from 'lucide-react';

export const CATEGORIES = [
  { id: 'all', label: 'All', icon: Sparkles, bg: 'bg-[#172121]', text: 'text-white', activeBg: 'bg-[#172121] text-white', badgeBg: 'bg-[#18A999] text-white' },
  { id: 'Food', label: 'Food & Drinks', icon: Utensils, bg: 'bg-[#DDF4EF]', text: 'text-[#172121]', activeBg: 'bg-[#18A999] text-white', badgeBg: 'bg-[#18A999] text-white' },
  { id: 'Music', label: 'Music & Nightlife', icon: Music, bg: 'bg-[#DDF4EF]', text: 'text-[#172121]', activeBg: 'bg-[#18A999] text-white', badgeBg: 'bg-[#18A999] text-white' },
  { id: 'Sports', label: 'Sports & Run', icon: Trophy, bg: 'bg-[#DDF4EF]', text: 'text-[#172121]', activeBg: 'bg-[#18A999] text-white', badgeBg: 'bg-[#18A999] text-white' },
  { id: 'Gaming', label: 'Board & Console', icon: Gamepad2, bg: 'bg-[#DDF4EF]', text: 'text-[#172121]', activeBg: 'bg-[#18A999] text-white', badgeBg: 'bg-[#18A999] text-white' },
  { id: 'Photography', label: 'Photography', icon: Camera, bg: 'bg-[#DDF4EF]', text: 'text-[#172121]', activeBg: 'bg-[#18A999] text-white', badgeBg: 'bg-[#18A999] text-white' },
  { id: 'Movies', label: 'Cinema & Chill', icon: Film, bg: 'bg-[#DDF4EF]', text: 'text-[#172121]', activeBg: 'bg-[#18A999] text-white', badgeBg: 'bg-[#18A999] text-white' },
  { id: 'Creative', label: 'Art & Design', icon: Palette, bg: 'bg-[#DDF4EF]', text: 'text-[#172121]', activeBg: 'bg-[#18A999] text-white', badgeBg: 'bg-[#18A999] text-white' },
  { id: 'Tech', label: 'Tech & Coffee', icon: Code, bg: 'bg-[#DDF4EF]', text: 'text-[#172121]', activeBg: 'bg-[#18A999] text-white', badgeBg: 'bg-[#18A999] text-white' },
  { id: 'Outdoors', label: 'Outdoors & Kayak', icon: Compass, bg: 'bg-[#DDF4EF]', text: 'text-[#172121]', activeBg: 'bg-[#18A999] text-white', badgeBg: 'bg-[#18A999] text-white' },
  { id: 'Other', label: 'Casual Meetups', icon: Zap, bg: 'bg-[#DDF4EF]', text: 'text-[#172121]', activeBg: 'bg-[#18A999] text-white', badgeBg: 'bg-[#18A999] text-white' }
];
