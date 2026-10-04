// src/pages/Onboarding.jsx
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { logActivity } from '@/lib/logActivity';
import { Loader2, Save, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { db } from '@/lib/AuthContext';

export default function Onboarding() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profileId, setProfileId] = useState(null);
  const [form, setForm] = useState({
    skills: '',
    interests: '',
    available_capital: '',
    hours_per_week: '',
    risk_tolerance: 'medium',
    income_goal: '',
  });

  useEffect(() => {
    (async () => {
      try {
        const profiles = await db.entities.UserProfile.list();
        if (profiles.length > 0) {
          const p = profiles[0];
          setProfileId(p.id);
          setForm({
            skills: (p.skills || []).join(', '),
            interests: (p.interests || []).join(', '),
            available_capital: p.available_capital ?? '',
            hours_per_week: p.hours_per_week ?? '',
            risk_tolerance: p.risk_tolerance || 'medium',
            income_goal: p.income_goal ?? '',
          });
        }
      } catch (e) {
        // no profile yet — fresh form
      }
      setLoading(false);
    })();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const data = {
      skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
      interests: form.interests.split(',').map((s) => s.trim()).filter(Boolean),
      available_capital: Number(form.available_capital) || 0,
      hours_per_week: Number(form.hours_per_week) || 0,
      risk_tolerance: form.risk_tolerance,
      income_goal: Number(form.income_goal) || 0,
    };
    try {
      if (profileId) {
        await db.entities.UserProfile.update(profileId, data);
      } else {
        const created = await db.entities.UserProfile.create(data);
        setProfileId(created.id);
      }
      await logActivity(
        'success',
        'user',
        `Profile ${profileId ? 'updated' : 'created'} — goal: $${data.income_goal}/mo, ${data.hours_per_week}h/wk, ${data.risk_tolerance} risk`
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast({ title: 'Profile saved', description: 'The agent will use these settings to tailor strategies.' });
    } catch (e) {
      toast({ title: 'Error', description: 'Could not save profile.', variant: 'destructive' });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      <header className="mb-6">
        <h1 className="text-xl font-heading font-semibold tracking-tight">Onboarding</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Tell the agent about yourself so it can tailor strategies.</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="skills">Skills <span className="text-muted-foreground font-normal">(comma-separated)</span></Label>
          <Input
            id="skills"
            value={form.skills}
            onChange={(e) => setForm({ ...form, skills: e.target.value })}
            placeholder="e.g. copywriting, SEO, Python"
            className="bg-card"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="interests">Interests <span className="text-muted-foreground font-normal">(comma-separated)</span></Label>
          <Input
            id="interests"
            value={form.interests}
            onChange={(e) => setForm({ ...form, interests: e.target.value })}
            placeholder="e.g. fintech, gaming, wellness"
            className="bg-card"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="capital">Available Capital ($)</Label>
            <Input
              id="capital"
              type="number"
              value={form.available_capital}
              onChange={(e) => setForm({ ...form, available_capital: e.target.value })}
              placeholder="5000"
              className="bg-card"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hours">Hours / Week</Label>
            <Input
              id="hours"
              type="number"
              value={form.hours_per_week}
              onChange={(e) => setForm({ ...form, hours_per_week: e.target.value })}
              placeholder="20"
              className="bg-card"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Risk Tolerance</Label>
          <div className="flex gap-2">
            {['low', 'medium', 'high'].map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setForm({ ...form, risk_tolerance: level })}
                className={cn(
                  'flex-1 px-4 py-2.5 rounded-md text-sm font-medium capitalize border transition-colors',
                  form.risk_tolerance === level
                    ? 'bg-primary/15 border-primary/40 text-primary'
                    : 'bg-card border-border text-muted-foreground hover:text-foreground'
                )}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="goal">Monthly Income Goal ($)</Label>
          <Input
            id="goal"
            type="number"
            value={form.income_goal}
            onChange={(e) => setForm({ ...form, income_goal: e.target.value })}
            placeholder="10000"
            className="bg-card"
          />
        </div>

        <Button type="submit" disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : saved ? 'Saved' : 'Save Profile'}
        </Button>
      </form>
    </div>
  );
}