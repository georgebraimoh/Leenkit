import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
import PageTransition from '../components/layout/PageTransition';
import EmptyState from '../components/common/EmptyState';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <PageTransition>
      <div className="max-w-xl mx-auto px-4 py-20">
        <EmptyState
          icon={Compass}
          title="Page not found"
          description="This page doesn't exist."
          actionLabel="Explore Hangouts"
          onAction={() => navigate('/explore')}
        />
      </div>
    </PageTransition>
  );
}
