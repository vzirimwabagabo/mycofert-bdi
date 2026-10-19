'use client';

// Site content panel — editable contact details and page texts.
// Five groups (contact, homepage, training, about, sustainability), each
// saved independently. Bilingual fields everywhere (FR / EN).

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useSite } from './context';
import { BiInput, BiTextarea, LangChip, authHeaders, type AdminContent } from './admin-ui';
import type { CmsSettings, IText } from '@/lib/cms-defaults';
import { Mail, MapPin, MessageCircle, Home, GraduationCap, Recycle, Info, Plus, Trash2 } from 'lucide-react';

async function saveSetting(token: string, key: string, value: unknown): Promise<boolean> {
  const res = await fetch('/api/admin/content', {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ kind: 'setting', key, value }),
  });
  return res.ok;
}

interface GroupProps {
  token: string;
  reload: () => Promise<void>;
}

function useSaveGroup(token: string, reload: () => Promise<void>, toastTitle: string, toastError: string) {
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  async function save(key: string, value: unknown): Promise<boolean> {
    setSaving(true);
    const ok = await saveSetting(token, key, value);
    setSaving(false);
    if (ok) {
      toast({ title: toastTitle });
      await reload();
    } else {
      toast({ title: toastError, variant: 'destructive' });
    }
    return ok;
  }
  return { saving, save };
}

// --- Contact group ----------------------------------------------------------

function ContactGroup({ token, initial, reload }: GroupProps & { initial: CmsSettings['contact'] }) {
  const { t } = useSite();
  const { saving, save } = useSaveGroup(token, reload, t.cms.saved, t.cms.errorSave);
  const [phones, setPhones] = useState(initial.phones.map((p) => ({ ...p })));
  const [whatsapp, setWhatsapp] = useState(initial.whatsappNumber);
  const [email, setEmail] = useState(initial.email);
  const [city, setCity] = useState(initial.city);
  const [country, setCountry] = useState(initial.country);
  const [hours, setHours] = useState<IText>({ ...initial.hours });

  async function onSave() {
    await save('contact', {
      phones: phones
        .map((p) => ({ label: p.label.trim(), tel: p.tel.replace(/[^\d+]/g, '') }))
        .filter((p) => p.tel.replace(/\D/g, '').length >= 6),
      whatsappNumber: whatsapp.replace(/\D/g, ''),
      email: email.trim(),
      city: city.trim(),
      country: country.trim(),
      hours: { fr: hours.fr.trim(), en: hours.en.trim() },
    });
  }

  return (
    <Card className="border-border/70 p-6">
      <div className="flex items-center gap-2">
        <MapPin className="h-5 w-5 text-[#2F6B3F]" aria-hidden="true" />
        <h3 className="font-semibold">{t.cms.groupContact}</h3>
      </div>

      <div className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label>{t.cms.phonesLabel}</Label>
          {phones.map((phone, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Input
                value={phone.label}
                onChange={(e) => {
                  const next = [...phones];
                  next[i] = { ...next[i], label: e.target.value };
                  setPhones(next);
                }}
                placeholder={t.cms.phoneLabelLabel}
                className="w-44"
                maxLength={30}
                aria-label={`${t.cms.phoneLabelLabel} ${i + 1}`}
              />
              <Input
                value={phone.tel}
                onChange={(e) => {
                  const next = [...phones];
                  next[i] = { ...next[i], tel: e.target.value };
                  setPhones(next);
                }}
                placeholder={t.cms.phoneTelLabel}
                className="w-48"
                maxLength={20}
                aria-label={`${t.cms.phoneTelLabel} ${i + 1}`}
              />
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 border-destructive/40 text-destructive hover:bg-destructive/10"
                onClick={() => setPhones(phones.filter((_, j) => j !== i))}
                disabled={phones.length <= 1}
                aria-label={t.cms.removePhone}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPhones([...phones, { label: '', tel: '' }])}
            disabled={phones.length >= 4}
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" /> {t.cms.addPhone}
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-[#2F6B3F]" aria-hidden="true" />
              {t.cms.whatsappLabel}
            </Label>
            <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} maxLength={20} />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-[#2F6B3F]" aria-hidden="true" />
              {t.cms.emailLabel}
            </Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label>{t.cms.cityLabel}</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} maxLength={60} />
          </div>
          <div className="space-y-1.5">
            <Label>{t.cms.countryLabel}</Label>
            <Input value={country} onChange={(e) => setCountry(e.target.value)} maxLength={60} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>{t.cms.hoursLabel}</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <LangChip lang="fr" />
              <Input value={hours.fr} onChange={(e) => setHours({ ...hours, fr: e.target.value })} maxLength={80} aria-label={`${t.cms.hoursLabel} (FR)`} />
            </div>
            <div className="flex items-center gap-2">
              <LangChip lang="en" />
              <Input value={hours.en} onChange={(e) => setHours({ ...hours, en: e.target.value })} maxLength={80} aria-label={`${t.cms.hoursLabel} (EN)`} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <Button onClick={onSave} disabled={saving} className="bg-[#2F6B3F] text-white hover:bg-[#275A34]">
          {saving ? t.cms.saving : t.cms.save}
        </Button>
      </div>
    </Card>
  );
}

// --- Homepage group ---------------------------------------------------------

function HomeGroup({ token, initial, reload }: GroupProps & { initial: CmsSettings['home'] }) {
  const { t } = useSite();
  const { saving, save } = useSaveGroup(token, reload, t.cms.saved, t.cms.errorSave);
  const [form, setForm] = useState(initial);

  return (
    <Card className="border-border/70 p-6">
      <div className="flex items-center gap-2">
        <Home className="h-5 w-5 text-[#2F6B3F]" aria-hidden="true" />
        <h3 className="font-semibold">{t.cms.groupHome}</h3>
      </div>
      <div className="mt-4 space-y-4">
        <BiInput label={t.cms.heroBadgeLabel} value={form.heroBadge} onChange={(heroBadge) => setForm({ ...form, heroBadge })} maxLength={120} />
        <BiInput label={t.cms.heroTitleLabel} value={form.heroTitle} onChange={(heroTitle) => setForm({ ...form, heroTitle })} maxLength={200} />
        <BiTextarea label={t.cms.heroSubtitleLabel} value={form.heroSubtitle} onChange={(heroSubtitle) => setForm({ ...form, heroSubtitle })} rows={2} maxLength={400} />
        <div className="grid gap-4 sm:grid-cols-3">
          <BiInput label={t.cms.stat1Label} value={form.stat1} onChange={(stat1) => setForm({ ...form, stat1 })} maxLength={80} />
          <BiInput label={t.cms.stat2Label} value={form.stat2} onChange={(stat2) => setForm({ ...form, stat2 })} maxLength={80} />
          <BiInput label={t.cms.stat3Label} value={form.stat3} onChange={(stat3) => setForm({ ...form, stat3 })} maxLength={80} />
        </div>
        <BiInput label={t.cms.ctaBandTitleLabel} value={form.ctaBandTitle} onChange={(ctaBandTitle) => setForm({ ...form, ctaBandTitle })} maxLength={150} />
        <BiTextarea label={t.cms.ctaBandTextLabel} value={form.ctaBandText} onChange={(ctaBandText) => setForm({ ...form, ctaBandText })} rows={2} maxLength={400} />
      </div>
      <div className="mt-5 flex justify-end">
        <Button
          onClick={() => save('home', form)}
          disabled={saving}
          className="bg-[#2F6B3F] text-white hover:bg-[#275A34]"
        >
          {saving ? t.cms.saving : t.cms.save}
        </Button>
      </div>
    </Card>
  );
}

// --- Training group ---------------------------------------------------------

function TrainingGroup({ token, initial, reload }: GroupProps & { initial: CmsSettings['training'] }) {
  const { t } = useSite();
  const { saving, save } = useSaveGroup(token, reload, t.cms.saved, t.cms.errorSave);
  const [form, setForm] = useState(initial);

  return (
    <Card className="border-border/70 p-6">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-5 w-5 text-[#2F6B3F]" aria-hidden="true" />
        <h3 className="font-semibold">{t.cms.groupTraining}</h3>
      </div>
      <div className="mt-4 space-y-4">
        <BiInput label={t.cms.trainingTitleLabel} value={form.title} onChange={(title) => setForm({ ...form, title })} maxLength={200} />
        <BiTextarea label={t.cms.trainingSubtitleLabel} value={form.subtitle} onChange={(subtitle) => setForm({ ...form, subtitle })} rows={2} maxLength={400} />
        <BiTextarea label={t.cms.trainingIntroLabel} value={form.intro} onChange={(intro) => setForm({ ...form, intro })} rows={4} maxLength={2000} />
      </div>
      <div className="mt-5 flex justify-end">
        <Button
          onClick={() => save('training', form)}
          disabled={saving}
          className="bg-[#2F6B3F] text-white hover:bg-[#275A34]"
        >
          {saving ? t.cms.saving : t.cms.save}
        </Button>
      </div>
    </Card>
  );
}

// --- About group ------------------------------------------------------------

function AboutGroup({ token, initial, reload }: GroupProps & { initial: CmsSettings['about'] }) {
  const { t } = useSite();
  const { saving, save } = useSaveGroup(token, reload, t.cms.saved, t.cms.errorSave);
  const [form, setForm] = useState(initial);

  return (
    <Card className="border-border/70 p-6">
      <div className="flex items-center gap-2">
        <Info className="h-5 w-5 text-[#2F6B3F]" aria-hidden="true" />
        <h3 className="font-semibold">{t.cms.groupAbout}</h3>
      </div>
      <div className="mt-4 space-y-4">
        <BiTextarea label={t.cms.missionLabel} value={form.missionText} onChange={(missionText) => setForm({ ...form, missionText })} rows={3} maxLength={1500} />
        <BiTextarea label={t.cms.visionLabel} value={form.visionText} onChange={(visionText) => setForm({ ...form, visionText })} rows={3} maxLength={1500} />
      </div>
      <div className="mt-5 flex justify-end">
        <Button
          onClick={() => save('about', form)}
          disabled={saving}
          className="bg-[#2F6B3F] text-white hover:bg-[#275A34]"
        >
          {saving ? t.cms.saving : t.cms.save}
        </Button>
      </div>
    </Card>
  );
}

// --- Sustainability group ---------------------------------------------------

function SustainabilityGroup({ token, initial, reload }: GroupProps & { initial: CmsSettings['sustainability'] }) {
  const { t } = useSite();
  const { saving, save } = useSaveGroup(token, reload, t.cms.saved, t.cms.errorSave);
  const [form, setForm] = useState(initial);

  return (
    <Card className="border-border/70 p-6">
      <div className="flex items-center gap-2">
        <Recycle className="h-5 w-5 text-[#2F6B3F]" aria-hidden="true" />
        <h3 className="font-semibold">{t.cms.groupSustainability}</h3>
      </div>
      <div className="mt-4 space-y-4">
        <BiInput label={t.cms.sustainTitleLabel} value={form.title} onChange={(title) => setForm({ ...form, title })} maxLength={200} />
        <BiTextarea label={t.cms.sustainSubtitleLabel} value={form.subtitle} onChange={(subtitle) => setForm({ ...form, subtitle })} rows={2} maxLength={400} />
        <BiTextarea label={t.cms.cycleLabel} value={form.cycleText} onChange={(cycleText) => setForm({ ...form, cycleText })} rows={4} maxLength={2000} />
      </div>
      <div className="mt-5 flex justify-end">
        <Button
          onClick={() => save('sustainability', form)}
          disabled={saving}
          className="bg-[#2F6B3F] text-white hover:bg-[#275A34]"
        >
          {saving ? t.cms.saving : t.cms.save}
        </Button>
      </div>
    </Card>
  );
}

// --- Panel ------------------------------------------------------------------

export function SettingsPanel({ token, content, reload }: { token: string; content: AdminContent; reload: () => Promise<void> }) {
  const { t } = useSite();
  const { settings } = content;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">{t.cms.contentIntro}</p>
      <ContactGroup key={`contact-${JSON.stringify(settings.contact)}`} token={token} initial={settings.contact} reload={reload} />
      <HomeGroup key={`home-${JSON.stringify(settings.home)}`} token={token} initial={settings.home} reload={reload} />
      <TrainingGroup key={`training-${JSON.stringify(settings.training)}`} token={token} initial={settings.training} reload={reload} />
      <AboutGroup key={`about-${JSON.stringify(settings.about)}`} token={token} initial={settings.about} reload={reload} />
      <SustainabilityGroup
        key={`sustainability-${JSON.stringify(settings.sustainability)}`}
        token={token}
        initial={settings.sustainability}
        reload={reload}
      />
    </div>
  );
}
