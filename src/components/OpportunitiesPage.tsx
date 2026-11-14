import React, { useCallback, useEffect, useState } from 'react';
import { Building2, CheckCircle2, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ApiError, apiRequest } from '../lib/api';
import type { OpportunityItem, OrganizationItem } from '../shared/types';
import gearEquipmentImg from '../assets/images/esports_gear_equipment_1794620723594.jpg';

export function OpportunitiesPage() {
  const { user, navigate } = useAuth();
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [category, setCategory] = useState('All');

  // Apply modal
  const [applyTarget, setApplyTarget] = useState<OpportunityItem | null>(null);
  const [pitch, setPitch] = useState('');
  const [portfolioLink, setPortfolioLink] = useState('');

  // Register org modal
  const [showOrgForm, setShowOrgForm] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState<'sponsor' | 'club' | 'organizer' | 'academy'>('club');
  const [orgCity, setOrgCity] = useState('Addis Ababa');
  const [orgDesc, setOrgDesc] = useState('');

  // Publish opportunity modal
  const [showPublishOpp, setShowPublishOpp] = useState(false);
  const [pubOrgId, setPubOrgId] = useState('');
  const [pubTitle, setPubTitle] = useState('');
  const [pubCat, setPubCat] = useState<'sponsorship' | 'club' | 'event' | 'career' | 'equipment'>('sponsorship');
  const [pubRegion, setPubRegion] = useState('Ethiopia');
  const [pubDeadline, setPubDeadline] = useState('2026-12-30');
  const [pubDesc, setPubDesc] = useState('');
  const [pubReq, setPubReq] = useState('');

  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [oppRes, orgRes] = await Promise.all([
        apiRequest<{ opportunities: OpportunityItem[] }>('/api/opportunities'),
        apiRequest<{ organizations: OrganizationItem[] }>('/api/organizations'),
      ]);
      setOpportunities(oppRes.opportunities);
      setOrganizations(orgRes.organizations);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const myVerifiedOrgs = organizations.filter(
    (o) => user && o.verifiedStatus === 'verified' && (o.ownerId === user.userId || user.role === 'admin')
  );

  const filtered = opportunities.filter(
    (o) => category === 'All' || o.category === category
  );

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !applyTarget) return;
    setErrorMsg(null);
    try {
      await apiRequest(`/api/opportunities/${applyTarget.id}/apply`, {
        method: 'POST',
        body: JSON.stringify({ pitch, portfolioLink }),
      });
      setFeedback(`Application submitted for "${applyTarget.title}".`);
      setApplyTarget(null);
      setPitch('');
      setPortfolioLink('');
      loadData();
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Application failed.');
    }
  };

  const handleRegisterOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErrorMsg(null);
    try {
      const res = await apiRequest<{ verifiedStatus: string }>('/api/organizations', {
        method: 'POST',
        body: JSON.stringify({
          name: orgName,
          orgType,
          country: 'Ethiopia',
          city: orgCity,
          description: orgDesc,
        }),
      });
      setFeedback(
        res.verifiedStatus === 'verified'
          ? `Organization "${orgName}" verified.`
          : `Organization "${orgName}" submitted for admin verification.`
      );
      setShowOrgForm(false);
      setOrgName('');
      setOrgDesc('');
      loadData();
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Could not register organization.');
    }
  };

  const handlePublishOpp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await apiRequest('/api/opportunities', {
        method: 'POST',
        body: JSON.stringify({
          orgId: pubOrgId || myVerifiedOrgs[0]?.id,
          title: pubTitle,
          category: pubCat,
          region: pubRegion,
          deadline: pubDeadline,
          description: pubDesc,
          requirements: pubReq,
        }),
      });
      setFeedback(`Opportunity "${pubTitle}" published.`);
      setShowPublishOpp(false);
      setPubTitle('');
      setPubDesc('');
      loadData();
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Could not publish opportunity.');
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
      {/* Header Spotlight */}
      <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-7 space-y-3">
          <p className="text-xs font-medium text-blue-400">Ecosystem Growth & Pathways</p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
            Gaming Opportunities, Equipment Access & Careers
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Connect with verified Ethiopian and African sponsors, fiber gaming hubs offering equipment access, regional events, and esports career fellowships.
          </p>
          <div className="pt-2 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => {
                if (!user) navigate('auth', { authMode: 'login' });
                else setShowOrgForm(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-500 text-xs font-semibold text-white min-h-[40px]"
            >
              <Building2 className="w-4 h-4 text-blue-400" aria-hidden="true" />
              <span>Register Organization</span>
            </button>
            {myVerifiedOrgs.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setPubOrgId(myVerifiedOrgs[0].id);
                  setShowPublishOpp(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white min-h-[40px]"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Publish Opportunity</span>
              </button>
            )}
          </div>
        </div>
        <div className="lg:col-span-5">
          <div className="overflow-hidden rounded-lg border border-slate-800 aspect-[4/3] bg-[#070B16]">
            <img
              src={gearEquipmentImg}
              alt="Pro-grade mechanical keyboard, gaming mouse, and headset"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </div>

      {feedback && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-4 py-2.5 text-xs text-emerald-200 flex items-center justify-between">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback(null)} className="text-slate-300 hover:text-white">
            Dismiss
          </button>
        </div>
      )}
      {errorMsg && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-4 py-2.5 text-xs text-rose-200">
          {errorMsg}
        </div>
      )}

      {/* Category Filter */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-lg bg-[#0B1120] border border-slate-800 w-fit">
        {[
          { key: 'All', label: 'All Opportunities' },
          { key: 'sponsorship', label: 'Sponsorships' },
          { key: 'equipment', label: 'Equipment Access' },
          { key: 'career', label: 'Esports Careers' },
          { key: 'event', label: 'Gaming Events' },
          { key: 'club', label: 'Club Programs' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setCategory(tab.key)}
            className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              category === tab.key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Opportunities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filtered.map((opp) => (
          <div key={opp.id} className="flex flex-col justify-between rounded-xl border border-slate-800 bg-[#0B1120] p-6">
            <div>
              <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                <span className="capitalize text-blue-400 font-medium">{opp.category}</span>
                <span className="font-mono tabular-nums">Deadline: {opp.deadline}</span>
              </div>
              <h2 className="mt-2 font-display text-lg font-semibold text-white">{opp.title}</h2>
              <p className="mt-1 text-xs text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
                <span>{opp.orgName} · {opp.region}</span>
              </p>
              <p className="mt-3 text-sm text-slate-300 leading-relaxed">{opp.description}</p>
              <p className="mt-3 pt-3 border-t border-slate-800/80 text-xs text-slate-400">
                <strong className="text-slate-200">Requirements:</strong> {opp.requirements}
              </p>
            </div>
            <div className="mt-5">
              <button
                type="button"
                disabled={opp.hasApplied}
                onClick={() => {
                  if (!user) navigate('auth', { authMode: 'login' });
                  else setApplyTarget(opp);
                }}
                className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold transition-colors min-h-[40px] ${
                  opp.hasApplied
                    ? 'border border-emerald-500/40 bg-emerald-950/30 text-emerald-300'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {opp.hasApplied ? 'Application Submitted' : 'Apply for Opportunity'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Verified Gaming Organizations */}
      <section className="space-y-4 pt-4 border-t border-slate-800/80">
        <h2 className="font-display text-xl font-bold text-white">
          Partner Organizations, Clubs & Sponsors
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {organizations.map((org) => (
            <div key={org.id} className="rounded-xl border border-slate-800 bg-[#0B1120] p-5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="capitalize text-blue-400 font-medium">{org.orgType}</span>
                <span className={org.verifiedStatus === 'verified' ? 'text-emerald-400' : 'text-amber-400'}>
                  {org.verifiedStatus === 'verified' ? 'Verified' : 'Pending'}
                </span>
              </div>
              <h3 className="mt-2 font-display text-base font-semibold text-white">{org.name}</h3>
              <p className="mt-1 text-xs text-slate-400">
                {org.city ? `${org.city}, ` : ''}{org.country}
              </p>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">{org.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Apply Modal */}
      {applyTarget && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <form onSubmit={handleApply} className="w-full max-w-md rounded-xl border border-slate-700 bg-[#0B1120] p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-white">Apply: {applyTarget.title}</h2>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Your Pitch / Team Background</label>
              <textarea
                rows={4}
                required
                minLength={10}
                value={pitch}
                onChange={(e) => setPitch(e.target.value)}
                placeholder="Share your game experience, roster goals, or why you need bootcamp/equipment support..."
                className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Highlight / Portfolio Link (Optional)</label>
              <input
                type="text"
                value={portfolioLink}
                onChange={(e) => setPortfolioLink(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setApplyTarget(null)} className="px-4 py-2 rounded-lg border border-slate-700 text-xs text-slate-300">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 text-xs font-semibold text-white">
                Submit Application
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Register Org Modal */}
      {showOrgForm && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <form onSubmit={handleRegisterOrg} className="w-full max-w-md rounded-xl border border-slate-700 bg-[#0B1120] p-6 space-y-3">
            <h2 className="font-display text-lg font-bold text-white">Register Organization / Sponsor</h2>
            <input
              type="text"
              required
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Organization Name"
              className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={orgType}
                onChange={(e) => setOrgType(e.target.value as any)}
                className="rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
              >
                <option value="club">Gaming Club</option>
                <option value="sponsor">Sponsor</option>
                <option value="organizer">Tournament Organizer</option>
                <option value="academy">Esports Academy</option>
              </select>
              <input
                type="text"
                value={orgCity}
                onChange={(e) => setOrgCity(e.target.value)}
                placeholder="City"
                className="rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
              />
            </div>
            <textarea
              rows={3}
              required
              value={orgDesc}
              onChange={(e) => setOrgDesc(e.target.value)}
              placeholder="Describe your mission and support programs..."
              className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowOrgForm(false)} className="px-4 py-2 rounded-lg border border-slate-700 text-xs text-slate-300">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 text-xs font-semibold text-white">
                Submit for Verification
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Publish Opportunity Modal */}
      {showPublishOpp && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <form onSubmit={handlePublishOpp} className="w-full max-w-md rounded-xl border border-slate-700 bg-[#0B1120] p-6 space-y-3">
            <h2 className="font-display text-lg font-bold text-white">Publish Official Opportunity</h2>
            <select
              value={pubOrgId}
              onChange={(e) => setPubOrgId(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
            >
              {myVerifiedOrgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            <input
              type="text"
              required
              value={pubTitle}
              onChange={(e) => setPubTitle(e.target.value)}
              placeholder="Opportunity Title"
              className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={pubCat}
                onChange={(e) => setPubCat(e.target.value as any)}
                className="rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
              >
                <option value="sponsorship">Sponsorship</option>
                <option value="equipment">Equipment Access</option>
                <option value="career">Esports Career</option>
                <option value="event">Gaming Event</option>
                <option value="club">Club Program</option>
              </select>
              <input
                type="date"
                value={pubDeadline}
                onChange={(e) => setPubDeadline(e.target.value)}
                className="rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
              />
            </div>
            <input
              type="text"
              value={pubRegion}
              onChange={(e) => setPubRegion(e.target.value)}
              placeholder="Region (e.g. Addis Ababa / Ethiopia)"
              className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
            />
            <textarea
              rows={3}
              required
              value={pubDesc}
              onChange={(e) => setPubDesc(e.target.value)}
              placeholder="Opportunity details..."
              className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
            />
            <input
              type="text"
              value={pubReq}
              onChange={(e) => setPubReq(e.target.value)}
              placeholder="Eligibility requirements..."
              className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3 py-2 text-xs text-white"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowPublishOpp(false)} className="px-4 py-2 rounded-lg border border-slate-700 text-xs text-slate-300">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 text-xs font-semibold text-white">
                Publish
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
