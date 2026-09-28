import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import { MapPin, ShieldCheck } from 'lucide-react';
import ProfileImageViewer from '../common/ProfileImageViewer';

export default function HostCard({ hostId }) {
  const { getUserById } = useUser();
  const host = getUserById(hostId);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  return (
    <>
      <div className="p-5 bg-white border border-[#E8E6E1] rounded-2xl flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setIsViewerOpen(true)}
            title={`View ${host.name}'s profile picture`}
            aria-label={`View ${host.name}'s profile picture`}
            className="focus:outline-none cursor-pointer"
          >
            <img
              src={host.avatar}
              alt={host.name}
              className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm hover:scale-105 hover:ring-2 hover:ring-[#18A999] transition-all duration-200"
            />
          </button>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#6F6F6F]">Hosted by</span>
              <ShieldCheck className="w-3.5 h-3.5 text-[#18A999]" />
            </div>
            <Link
              to={`/profile/${host.username}`}
              className="font-bold text-[#171717] hover:text-[#18A999] transition-colors font-heading text-lg block"
            >
              {host.name}
            </Link>
            <p className="text-xs text-[#6F6F6F] flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 text-[#18A999]" /> {host.location}
            </p>
          </div>
        </div>

        <Link
          to={`/profile/${host.username}`}
          className="px-4 py-2 text-xs font-semibold text-[#171717] bg-[#F7F6F2] hover:bg-[#E8E6E1] rounded-full transition-colors pressable"
        >
          View profile
        </Link>
      </div>

      <ProfileImageViewer
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        src={host.avatar}
        alt={`${host.name}'s profile picture`}
      />
    </>
  );
}
