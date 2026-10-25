import React, { useState, useEffect, useRef } from 'react';
import Button from '../common/Button';
import Avatar from '../common/Avatar';
import Loader from '../common/Loader';
import { hangoutService } from '../../services/hangout/hangoutService';
import { useUser } from '../../context/UserContext';
import { useToast } from '../common/Toast';
import { Camera, Image as ImageIcon, Trash2, Clock, Sparkles, AlertCircle } from 'lucide-react';

export default function MemoriesTab({ hangout, isHost, isAttending }) {
  const { currentUser } = useUser();
  const { showToast } = useToast();

  const [memories, setMemories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [caption, setCaption] = useState('');
  const [phase, setPhase] = useState('during');
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const loadMemories = async () => {
    setIsLoading(true);
    try {
      const data = await hangoutService.fetchMemories(hangout.id);
      setMemories(data);
    } catch (err) {
      console.warn('Failed to load memories:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (hangout?.id) {
      loadMemories();
    }
  }, [hangout?.id]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setError('Image must be under 8MB.');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError('');
  };

  const handleCancelUpload = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setCaption('');
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile || !currentUser?.id) return;

    setIsUploading(true);
    setError('');

    try {
      await hangoutService.addMemory(hangout.id, currentUser.id, {
        file: selectedFile,
        caption,
        phase: isHost ? phase : 'during'
      });
      showToast('Memory shared! 📸', 'success');
      handleCancelUpload();
      loadMemories();
    } catch (err) {
      setError(err.message || 'Could not upload memory.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (memoryId) => {
    if (!window.confirm('Delete this photo?')) return;
    try {
      await hangoutService.deleteMemory(memoryId);
      setMemories(prev => prev.filter(m => m.id !== memoryId));
      showToast('Photo removed', 'info');
    } catch (err) {
      showToast(err.message || 'Could not delete photo', 'error');
    }
  };

  const canUpload = isHost || isAttending;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
      {/* Upload Box for Members */}
      {canUpload && (
        <div className="bg-[#FFF8EE] border-2 border-ink rounded-3xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#111111] flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-[#18A999]" /> Share a Hangout Memory
            </span>
            <span className="text-[10px] text-[#6F6F6F]">Photos from before, during, or after</span>
          </div>

          {error && (
            <p className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600 font-medium flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
            </p>
          )}

          {!previewUrl ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                id="memory-file-upload"
              />
              <label
                htmlFor="memory-file-upload"
                className="w-full py-4 px-3 bg-white hover:bg-[#EEF1EF] border-2 border-dashed border-ink/40 hover:border-ink rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <div className="w-10 h-10 rounded-full bg-[#DDF4EF] text-[#18A999] flex items-center justify-center">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-[#111111]">Choose a photo to post</span>
                <span className="text-[10px] text-[#6F6F6F]">JPG, PNG, or WEBP up to 8MB</span>
              </label>
            </div>
          ) : (
            <form onSubmit={handleUploadSubmit} className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden border-2 border-ink max-h-60 bg-black">
                <img src={previewUrl} alt="Preview" className="w-full h-full object-contain max-h-60" />
                <button
                  type="button"
                  onClick={handleCancelUpload}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/90 text-white rounded-full text-xs"
                >
                  ✕
                </button>
              </div>

              {isHost && (
                <div className="flex gap-2">
                  {['before', 'during', 'after'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPhase(p)}
                      className={`flex-1 py-1 px-2 rounded-xl text-xs font-extrabold uppercase border ${
                        phase === p
                          ? 'bg-[#18A999] text-white border-ink'
                          : 'bg-white text-[#3D4948] border-ink/20'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}

              <input
                type="text"
                placeholder="Add a caption... (optional)"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={200}
                className="w-full px-3 py-2.5 bg-white border border-ink/40 rounded-xl text-xs outline-none focus:border-[#18A999]"
              />

              <div className="flex gap-2">
                <Button type="button" onClick={handleCancelUpload} variant="outline" size="sm" className="w-1/3">
                  Cancel
                </Button>
                <Button type="submit" disabled={isUploading} variant="primary" size="sm" className="w-2/3">
                  {isUploading ? 'Posting...' : 'Post to Memories'}
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Memories Photo Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#6F6F6F] flex items-center justify-between">
          <span>Moments & Highlights ({memories.length})</span>
          <button type="button" onClick={loadMemories} className="text-[11px] font-bold text-[#087F73] hover:underline">
            Refresh
          </button>
        </h3>

        {isLoading ? (
          <div className="py-12 flex justify-center">
            <Loader />
          </div>
        ) : memories.length === 0 ? (
          <div className="p-8 text-center bg-white border-2 border-ink rounded-3xl space-y-2">
            <div className="w-12 h-12 rounded-full bg-[#DDF4EF] text-[#18A999] flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <h4 className="font-heading font-extrabold text-sm text-[#111111]">No photos shared yet</h4>
            <p className="text-xs text-[#6F6F6F] max-w-xs mx-auto">
              Be the first to share a teaser before the meetup or memorable snaps during the Hangout!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {memories.map((m) => (
              <div key={m.id} className="bg-white border-2 border-ink rounded-2xl overflow-hidden shadow-xs flex flex-col">
                <div className="relative aspect-4/3 bg-stone-100 overflow-hidden">
                  <img src={m.imageUrl} alt={m.caption || 'Memory'} className="w-full h-full object-cover" />
                  <span className="absolute top-2 left-2 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider bg-black/60 text-white rounded-md backdrop-blur-xs">
                    {m.phase}
                  </span>
                  {(isHost || m.userId === currentUser?.id) && (
                    <button
                      type="button"
                      onClick={() => handleDelete(m.id)}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-rose-600 text-white rounded-full transition-colors"
                      title="Delete photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                  {m.caption && (
                    <p className="text-xs text-[#111111] font-medium leading-relaxed">{m.caption}</p>
                  )}
                  <div className="flex items-center justify-between text-[11px] text-[#6F6F6F] pt-1 border-t border-ink/10">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Avatar src={m.author?.avatar} name={m.author?.name || 'Member'} size="xs" />
                      <span className="font-bold truncate text-[#111111]">{m.author?.name || 'Member'}</span>
                    </div>
                    <span className="shrink-0 flex items-center gap-1 text-[10px]">
                      <Clock className="w-3 h-3" />
                      {new Date(m.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
