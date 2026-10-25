import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import PageTransition from '../components/layout/PageTransition';
import SearchBar from '../components/hangout/SearchBar';
import FilterBar from '../components/hangout/FilterBar';
import HangoutGrid from '../components/hangout/HangoutGrid';
import Button from '../components/common/Button';
import { useLeenkit } from '../context/LeenkitContext';
import { useUser } from '../context/UserContext';
import { useLocationContext } from '../context/LocationContext';
import { RefreshCw, AlertTriangle, Shield, Clock } from 'lucide-react';
import { isOpenHangout, sortByEventDate, parseLocalDate, todayISO } from '../utils/format';

function isoOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function matchesWhen(hangout, when) {
  if (when === 'any') return true;
  const day = String(hangout.date || '').slice(0, 10);
  if (!day) return false;
  const today = todayISO();
  if (when === 'today') return day === today;

  const now = parseLocalDate(today);
  if (when === 'week') {
    const end = new Date(now);
    end.setDate(end.getDate() + 7);
    return day >= today && day <= isoOf(end);
  }
  if (when === 'weekend') {
    // Upcoming Friday-Sunday (or the current one, if we're in it).
    const dow = now.getDay(); // 0 Sun .. 6 Sat
    const start = new Date(now);
    if (dow >= 1 && dow <= 4) start.setDate(now.getDate() + (5 - dow));
    const end = new Date(now);
    end.setDate(now.getDate() + (dow === 0 ? 0 : 7 - dow));
    return day >= isoOf(start) && day <= isoOf(end);
  }
  return true;
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 animate-pulse" aria-busy="true" aria-label="Loading Hangouts">
      {[0, 1, 2].map(i => (
        <div key={i} className="h-80 bg-white border-2 border-ink rounded-3xl overflow-hidden">
          <div className="h-48 bg-[#E8E6E1]" />
          <div className="p-5 space-y-3">
            <div className="h-4 w-3/4 bg-[#E8E6E1] rounded-full" />
            <div className="h-3 w-1/2 bg-[#E8E6E1] rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Explore() {
  const { hangouts, isHangoutsLoading, hangoutsError, reloadHangouts } = useLeenkit();
  const { currentUser } = useUser();
  const isAdmin = Boolean(currentUser?.isAdmin);
  const [adminApprovalFilter, setAdminApprovalFilter] = useState('all'); // 'all' | 'pending' | 'approved'
  const { activeSearchLocation, resetLocationFilter } = useLocationContext();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'all');
  const [when, setWhen] = useState(searchParams.get('when') || 'any');
  const [price, setPrice] = useState(searchParams.get('price') || 'any');

  const pendingCount = useMemo(() => {
    return hangouts.filter(h => h.approvalStatus === 'pending').length;
  }, [hangouts]);

  useEffect(() => {
    const cat = searchParams.get('category');
    setSelectedCategory(cat || 'all');
  }, [searchParams]);

  const setParam = (key, value, defaultValue) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (!value || value === defaultValue) next.delete(key);
      else next.set(key, value);
      return next;
    }, { replace: true });
  };

  const handleCategorySelect = (catId) => {
    setSelectedCategory(catId);
    setParam('category', catId, 'all');
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setWhen('any');
    setPrice('any');
    setAdminApprovalFilter('all');
    resetLocationFilter();
    setSearchParams({}, { replace: true });
  };

  const filteredHangouts = useMemo(() => {
    const area = (activeSearchLocation?.placeName || '').trim().toLowerCase();
    const q = searchQuery.trim().toLowerCase();

    const list = hangouts.filter(hangout => {
      if (!isAdmin) {
        if (!isOpenHangout(hangout)) return false;
      } else {
        if (adminApprovalFilter === 'pending') {
          if (hangout.approvalStatus !== 'pending') return false;
        } else if (adminApprovalFilter === 'approved') {
          if (!isOpenHangout(hangout)) return false;
        } else {
          // 'all': Show open hangouts AND pending review hangouts
          const isPending = hangout.approvalStatus === 'pending';
          if (!isPending && !isOpenHangout(hangout)) return false;
        }
      }

      const loc = typeof hangout.location === 'object' ? hangout.location : { placeName: hangout.location || '' };

      if (selectedCategory !== 'all' && (hangout.category || '').toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }
      if (price === 'free' && hangout.isPaid) return false;
      if (price === 'paid' && !hangout.isPaid) return false;
      if (!matchesWhen(hangout, when)) return false;

      if (area) {
        const haystack = [loc.placeName, loc.address, loc.city, loc.country].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(area)) return false;
      }

      if (q) {
        const haystack = [
          hangout.title, hangout.description, hangout.category,
          loc.placeName, loc.address, loc.city, loc.country
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });

    return sortByEventDate(list);
  }, [hangouts, activeSearchLocation, searchQuery, selectedCategory, price, when, isAdmin, adminApprovalFilter]);

  const locationTitle = activeSearchLocation?.placeName ? `in ${activeSearchLocation.placeName}` : 'near you';
  const isFiltered = selectedCategory !== 'all' || searchQuery || activeSearchLocation || when !== 'any' || price !== 'any' || adminApprovalFilter !== 'all';

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Admin Review Mode Banner */}
        {isAdmin && (
          <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-amber-200 text-amber-900 border border-ink/20 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5" />
              </span>
              <div>
                <p className="text-sm font-extrabold text-[#111111] flex items-center gap-2">
                  <span>Admin Moderation View</span>
                  {pendingCount > 0 && (
                    <span className="px-2.5 py-0.5 text-xs font-extrabold bg-amber-400 text-amber-950 rounded-full border border-ink/20">
                      {pendingCount} Pending Review
                    </span>
                  )}
                </p>
                <p className="text-xs text-[#3D4948]">
                  Pending Hangouts are visible to you here. Click any card to review and approve it.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {pendingCount > 0 && (
                <button
                  type="button"
                  onClick={() => setAdminApprovalFilter(prev => prev === 'pending' ? 'all' : 'pending')}
                  className={`flex-1 sm:flex-initial px-3.5 py-2 text-xs font-extrabold rounded-xl border-2 border-ink transition-colors cursor-pointer ${
                    adminApprovalFilter === 'pending'
                      ? 'bg-amber-400 text-amber-950 shadow-xs'
                      : 'bg-white hover:bg-stone-50 text-[#111111]'
                  }`}
                >
                  {adminApprovalFilter === 'pending' ? 'Showing Pending Only' : `Show Pending (${pendingCount})`}
                </button>
              )}
              <Link
                to="/admin"
                className="flex-1 sm:flex-initial px-3.5 py-2 text-xs font-extrabold bg-[#18A999] hover:bg-[#087F73] text-white rounded-xl border-2 border-ink transition-colors text-center"
              >
                Admin Panel
              </Link>
            </div>
          </div>
        )}

        <div className="space-y-4 max-w-3xl">
          <h1 className="text-4xl sm:text-5xl font-extrabold font-heading text-[#111111] tracking-tight">
            What's on <span className="text-[#FF6B2C]">{locationTitle}</span>
          </h1>
          <SearchBar
            value={searchQuery}
            onChange={(v) => { setSearchQuery(v); setParam('q', v.trim(), ''); }}
          />
        </div>

        <FilterBar
          selectedCategory={selectedCategory}
          onSelectCategory={handleCategorySelect}
          when={when}
          onWhenChange={(v) => { setWhen(v); setParam('when', v, 'any'); }}
          price={price}
          onPriceChange={(v) => { setPrice(v); setParam('price', v, 'any'); }}
        />

        <div className="flex items-center justify-between pt-4 border-t-2 border-ink text-xs text-[#6F6F6F]" aria-live="polite">
          <span>
            {isHangoutsLoading
              ? 'Loading...'
              : <><strong className="text-[#111111]">{filteredHangouts.length}</strong> {filteredHangouts.length === 1 ? 'Hangout' : 'Hangouts'}</>}
          </span>
          {isFiltered && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[#087F73] hover:underline font-semibold cursor-pointer flex items-center gap-1 pressable link-nudge"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {hangoutsError && !isHangoutsLoading ? (
          <div role="alert" className="max-w-md mx-auto p-8 bg-white border-2 border-ink rounded-3xl text-center space-y-4">
            <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" aria-hidden="true" />
            <p className="text-sm text-[#3D4948]">{hangoutsError}</p>
            <Button onClick={reloadHangouts} variant="outline" size="md">Try again</Button>
          </div>
        ) : isHangoutsLoading ? (
          <GridSkeleton />
        ) : (
          <HangoutGrid hangouts={filteredHangouts} onResetFilters={handleResetFilters} />
        )}
      </div>
    </PageTransition>
  );
}
