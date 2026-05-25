import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { getUserProfile, updateUserProfile, uploadProfilePhoto, getUserRatings, subscribeToPlatformSettings } from '../../lib/firebaseServices';
import Avatar from '../../components/ui/Avatar';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input, { TextArea } from '../../components/ui/Input';
import { formatCredits, formatTimestamp } from '../../lib/utils';
import type { UserProfile as UserProfileType, Rating, PlatformSettings } from '../../types';
import toast from 'react-hot-toast';

export default function Profile() {
  const { uid } = useParams();
  const { currentUser, userProfile: myProfile, refreshProfile } = useAuth();
  const [profile, setProfile] = useState<UserProfileType | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState('');
  const [settings, setSettings] = useState<PlatformSettings | null>(null);

  const isOwnProfile = currentUser?.uid === uid;

  useEffect(() => {
    if (!uid) return;
    const loadProfile = async () => {
      const prof = await getUserProfile(uid);
      setProfile(prof);
      if (prof) {
        setBio(prof.bio);
        setSkills(prof.skills.join(', '));
        const ratingsData = await getUserRatings(uid);
        setRatings(ratingsData);
      }
      setLoading(false);
    };
    loadProfile();
  }, [uid]);

  useEffect(() => {
    const unsub = subscribeToPlatformSettings((s) => setSettings(s));
    return unsub;
  }, []);

  const handleUpdateProfile = async () => {
    if (!uid) return;
    try {
      await updateUserProfile(uid, {
        bio,
        skills: skills.split(',').map(s => s.trim()).filter(Boolean),
      });
      toast.success('Profile updated!');
      setEditing(false);
      refreshProfile();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uid) return;
    try {
      await uploadProfilePhoto(uid, file);
      toast.success('Photo updated!');
      refreshProfile();
    } catch (err: any) {
      toast.error('Failed to upload photo');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-20">
        <p className="text-surface-400">User not found</p>
      </div>
    );
  }

  const avgClientRating = profile.clientRatingCount > 0 ? profile.clientRating : null;
  const avgHelperRating = profile.helperRatingCount > 0 ? profile.helperRating : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto"
    >
      {/* Profile Header */}
      <Card className="!p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="relative">
            <Avatar src={profile.photoURL} name={profile.displayName} size="xl" />
            {isOwnProfile && (
              <label className="absolute -bottom-1 -right-1 bg-primary-600 hover:bg-primary-500 text-white p-1.5 rounded-full cursor-pointer transition-colors shadow-lg">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
              </label>
            )}
          </div>
          <div className="text-center sm:text-left flex-1">
            <h1 className="text-2xl font-bold text-white">{profile.displayName}</h1>
            <p className="text-surface-400 text-sm">{profile.email}</p>
            
            <div className="flex flex-wrap gap-3 mt-4 justify-center sm:justify-start">
              <div className="text-center bg-surface-800/50 rounded-lg px-4 py-2">
                <p className="text-xl font-bold text-primary-400">⚡ {formatCredits(profile.credits)}</p>
                <p className="text-xs text-surface-500">Credits</p>
              </div>
              <div className="text-center bg-surface-800/50 rounded-lg px-4 py-2">
                <p className="text-xl font-bold text-white">{profile.tasksCompleted}</p>
                <p className="text-xs text-surface-500">Completed</p>
              </div>
              <div className="text-center bg-surface-800/50 rounded-lg px-4 py-2">
                <p className="text-xl font-bold text-amber-400">{avgHelperRating || '-'}</p>
                <p className="text-xs text-surface-500">Helper Rating</p>
              </div>
              <div className="text-center bg-surface-800/50 rounded-lg px-4 py-2">
                <p className="text-xl font-bold text-amber-400">{avgClientRating || '-'}</p>
                <p className="text-xs text-surface-500">Client Rating</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bio */}
        {editing ? (
          <div className="mt-4 space-y-4">
            <TextArea
              label="Bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="Tell others about yourself..."
            />
            <Input
              label="Skills (comma separated)"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              placeholder="e.g., Design, Writing, Development"
            />
            <div className="flex gap-2">
              <Button onClick={handleUpdateProfile}>Save</Button>
              <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {profile.bio && <p className="text-sm text-surface-300">{profile.bio}</p>}
            {profile.skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {profile.skills.map((skill) => (
                  <span key={skill} className="text-xs px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-400 border border-primary-500/20">
                    {skill}
                  </span>
                ))}
              </div>
            )}
            {isOwnProfile && (
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                Edit Profile
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card className="text-center !p-4">
          <p className="text-lg font-bold text-white">{profile.tasksPosted}</p>
          <p className="text-xs text-surface-400">Tasks Posted</p>
        </Card>
        <Card className="text-center !p-4">
          <p className="text-lg font-bold text-white">{profile.tasksCompleted}</p>
          <p className="text-xs text-surface-400">Tasks Done</p>
        </Card>
        <Card className="text-center !p-4">
          <p className="text-lg font-bold text-emerald-400">{formatCredits(profile.creditsEarned)}</p>
          <p className="text-xs text-surface-400">Earned</p>
        </Card>
        <Card className="text-center !p-4">
          <p className="text-lg font-bold text-primary-400">{formatCredits(profile.creditsSpent)}</p>
          <p className="text-xs text-surface-400">Spent</p>
        </Card>
      </div>

      {/* Reviews */}
      <Card>
        <h2 className="text-lg font-semibold text-white mb-4">Reviews</h2>
        {ratings.length === 0 ? (
          <p className="text-sm text-surface-500">No reviews yet</p>
        ) : (
          <div className="space-y-3">
            {ratings.map((rating) => (
              <div key={rating.id} className="p-3 rounded-lg bg-surface-800/30 border border-surface-800/50">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-amber-400">{'★'.repeat(rating.score)}{'☆'.repeat(5 - rating.score)}</span>
                  <span className="text-xs text-surface-400">
                    by {rating.fromRole === 'client' ? 'Client' : 'Helper'}
                  </span>
                </div>
                {rating.description && (
                  <p className="text-sm text-surface-300">{rating.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </motion.div>
  );
}
