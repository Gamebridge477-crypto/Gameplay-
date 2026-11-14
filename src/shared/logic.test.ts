import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canRegisterForTournament,
  canUserManageTournament,
  evaluateConnectionQuality,
  sanitizePublicProfile,
  scoreMatchmakingCandidate,
  validateRegistrationInput,
} from './logic';
import type { AuthUser, PublicProfile } from './types';

test('validateRegistrationInput rejects invalid fields and accepts valid Ethiopian gamer registration', () => {
  const bad = validateRegistrationInput({
    fullName: 'A',
    username: 'bad user!',
    email: 'not-an-email',
    password: '123',
    country: '',
    favoriteGames: [],
    gamingPlatform: '',
  });
  assert.equal(bad.valid, false);
  assert.ok(bad.errors.length >= 5);

  const good = validateRegistrationInput({
    fullName: 'Dawit Mekonnen',
    username: 'dawit_addis',
    email: 'dawit@gamebridge.et',
    password: 'Password123',
    country: 'Ethiopia',
    city: 'Addis Ababa',
    favoriteGames: ['Valorant', 'EA FC 25'],
    gamingPlatform: 'PC',
  });
  assert.equal(good.valid, true);
  assert.equal(good.errors.length, 0);
});

test('scoreMatchmakingCandidate filters accurately and boosts compatible regional players', () => {
  const viewer: PublicProfile = {
    userId: 'u1',
    fullName: 'Dawit',
    username: 'dawit_addis',
    avatarUrl: '',
    country: 'Ethiopia',
    city: 'Addis Ababa',
    gamingPlatform: 'PC',
    experienceLevel: 'Competitive',
    preferredLanguage: 'Amharic / English',
    availability: 'Evenings',
    gamingStyle: 'Aggressive Entry',
    bio: '',
    favoriteGames: ['Valorant', 'CS2'],
    achievements: [],
    wins: 12,
    matchesPlayed: 20,
    role: 'gamer',
  };

  const candidateMatch: PublicProfile = {
    ...viewer,
    userId: 'u2',
    username: 'abebe_val',
    favoriteGames: ['Valorant'],
  };

  const candidateMismatch: PublicProfile = {
    ...viewer,
    userId: 'u3',
    username: 'kenya_mobile',
    country: 'Kenya',
    gamingPlatform: 'Mobile',
    favoriteGames: ['PUBG Mobile'],
  };

  const res1 = scoreMatchmakingCandidate(viewer, candidateMatch, { game: 'Valorant', region: 'Ethiopia' });
  assert.equal(res1.matches, true);
  assert.ok(res1.score >= 85);

  const res2 = scoreMatchmakingCandidate(viewer, candidateMismatch, { game: 'Valorant' });
  assert.equal(res2.matches, false);
});

test('evaluateConnectionQuality classifies network tiers accurately', () => {
  const excellent = evaluateConnectionQuality({
    downloadMbps: 42,
    uploadMbps: 18,
    pingMs: 28,
    jitterMs: 5,
  });
  assert.equal(excellent.stability, 'Excellent');

  const unstable = evaluateConnectionQuality({
    downloadMbps: 2.1,
    uploadMbps: 0.4,
    pingMs: 185,
    jitterMs: 48,
  });
  assert.equal(unstable.stability, 'Unstable');
});

test('canRegisterForTournament enforces open status, capacity, and deadline', () => {
  const openTourney = {
    status: 'open' as const,
    registrationDeadline: '2026-12-20T23:59:59Z',
    maxParticipants: 16,
  };
  assert.equal(canRegisterForTournament(openTourney, 10, '2026-11-15T12:00:00Z').allowed, true);
  assert.equal(canRegisterForTournament(openTourney, 16, '2026-11-15T12:00:00Z').allowed, false);
  assert.equal(canRegisterForTournament(openTourney, 5, '2026-12-25T00:00:00Z').allowed, false);
  assert.equal(
    canRegisterForTournament({ ...openTourney, status: 'pending_approval' }, 0, '2026-11-15T12:00:00Z').allowed,
    false
  );
});

test('sanitizePublicProfile removes PII email and blockedUserIds and checks tournament ownership', () => {
  const fullUser: AuthUser = {
    userId: 'u1',
    email: 'private@example.et',
    status: 'active',
    blockedUserIds: ['u99'],
    createdAt: '2026-01-01T00:00:00Z',
    fullName: 'Selamawit Tadesse',
    username: 'selam_org',
    avatarUrl: '',
    country: 'Ethiopia',
    city: 'Hawassa',
    gamingPlatform: 'PC',
    experienceLevel: 'Pro',
    preferredLanguage: 'Amharic',
    availability: 'Weekends',
    gamingStyle: 'IGL / Strategist',
    bio: 'Organizer',
    favoriteGames: ['Valorant'],
    achievements: [],
    wins: 5,
    matchesPlayed: 8,
    role: 'organizer',
  };

  const sanitized = sanitizePublicProfile(fullUser);
  assert.equal('email' in sanitized, false);
  assert.equal('blockedUserIds' in sanitized, false);
  assert.equal(sanitized.username, 'selam_org');

  assert.equal(canUserManageTournament({ userId: 'u1', role: 'organizer' }, { organizerId: 'u1' }), true);
  assert.equal(canUserManageTournament({ userId: 'u2', role: 'gamer' }, { organizerId: 'u1' }), false);
  assert.equal(canUserManageTournament({ userId: 'admin1', role: 'admin' }, { organizerId: 'u1' }), true);
});
