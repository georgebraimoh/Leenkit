import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import { MapPin, ShieldCheck } from 'lucide-react';
import ProfileImageViewer from '../common/ProfileImageViewer';
import Avatar from '../common/Avatar';

export default function HostCard({ hostId }) {
  const { getUserById } = useUser();
  const host = getUserById(hostId) || { name: 'LEENKIT Member' };
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const avatar = <Avatar src={host.avatar} name={host.name} size="xl" className="border-2 border-white shadow-sm" />;

  return (
    <>
      <div className="p-5 bg-white border border-[#E8E6E1] rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-4 min-w-0">
          {host.avatar ? (
            <button
              type="button"
              onClick={() => setIsViewerOpen(true)}
              aria-label={`View ${host.name}'s profile picture`}
              className="rounded-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#18A999]"
            >
              {avatar}
            </button>
          ) : avatar}

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#6F6F6F]">Hosted by</span>
              {host.isVerifiedOrganizer && (
                <span className="inline-flex items-center gap-0.5 text-xs font-bold text-[#087F73]" title="Verified Organizer">
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" /> Verified
                </span>
              )}
            </div>
            {host.username ? (
              <Link
                to={`/profile/${host.username}`}
                className="font-bold text-[#171717] hover:text-[#18A999] transition-colors font-heading text-lg block truncate"
              >
                {host.name}
              </Link>
            ) : (
              <span className="font-bold text-[#171717] font-heading text-lg block truncate">{host.name}</span>
            )}
            {host.location && (
              <p className="text-xs text-[#6F6F6F] flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-[#18A999]" aria-hidden="true" /> {host.location}
              </p>
            )}
          </div>
        </div>

        {host.username && (
          <Link
            to={`/profile/${host.username}`}
            className="px-4 py-2 text-xs font-semibold text-[#171717] bg-[#F7F6F2] hover:bg-[#E8E6E1] rounded-full transition-colors pressable"
          >
            View profile
          </Link>
        )}
      </div>

      {host.avatar && (
        <ProfileImageViewer
          isOpen={isViewerOpen}
          onClose={() => setIsViewerOpen(false)}
          src={host.avatar}
          alt={`${host.name}'s profile picture`}
        />
      )}
    </>
  );
}
