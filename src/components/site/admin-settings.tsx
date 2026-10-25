'use client';

// Site content panel — editable contact details and page texts.
// Five groups (contact, homepage, training, about, sustainability), each
// saved independently. Bilingual fields everywhere (FR / EN).

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useSite } from './context';
import { BiInput, BiTextarea, ImagePicker, LangChip, authHeaders, type AdminContent, type ImageValue } from './admin-ui';
import {
  resolveImage,
  type CmsSettings,
  type CmsTeamMember,
  type CmsTeam,
  type CmsPartner,
  type CmsPartners,
  type IText,
} from '@/lib/cms-defaults';
import {
  Mail,
  MapPin,
  MessageCircle,
  Home,
  GraduationCap,
  Recycle,
  Info,
  Plus,
  Trash2,
  Lock,
  KeyRound,
  Users,
  Handshake,
  Edit2,
  ArrowUp,
  ArrowDown,
  Globe,
  Eye,
  EyeOff,
} from 'lucide-react';

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
        {/* Hero image: Cloudinary upload wins; '' falls back to the local hero file in public/images. */}
        <ImagePicker
          label={t.cms.heroImageLabel}
          token={token}
          value={{ imageKey: 'hero', imageUrl: form.heroImage || null }}
          onChange={(v) => setForm({ ...form, heroImage: v.imageUrl ?? '' })}
        />
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

// --- Team group -------------------------------------------------------------

function TeamGroup({ token, initial, reload }: GroupProps & { initial: CmsSettings['team'] }) {
  const { t, lang } = useSite();
  const { toast } = useToast();
  const [members, setMembers] = useState<CmsTeamMember[]>(initial?.members ? [...initial.members] : []);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState<IText>({ fr: '', en: '' });
  const [formBio, setFormBio] = useState<IText>({ fr: '', en: '' });
  const [formImage, setFormImage] = useState<ImageValue>({ imageKey: 'training', imageUrl: null });
  const [formPublished, setFormPublished] = useState(true);

  function openNew() {
    setEditingIndex(null);
    setFormName('');
    setFormRole({ fr: '', en: '' });
    setFormBio({ fr: '', en: '' });
    setFormImage({ imageKey: 'training', imageUrl: null });
    setFormPublished(true);
    setDialogOpen(true);
  }

  function openEdit(index: number) {
    const m = members[index];
    if (!m) return;
    setEditingIndex(index);
    setFormName(m.name);
    setFormRole({ fr: m.role.fr, en: m.role.en });
    setFormBio(m.bio ? { fr: m.bio.fr, en: m.bio.en } : { fr: '', en: '' });
    setFormImage({ imageKey: m.imageKey || 'training', imageUrl: m.imageUrl || null });
    setFormPublished(m.published !== false);
    setDialogOpen(true);
  }

  async function persist(updated: CmsTeamMember[]) {
    setSaving(true);
    const ok = await saveSetting(token, 'team', {
      title: initial?.title || { fr: 'Notre Équipe', en: 'Our Team' },
      subtitle: initial?.subtitle || {
        fr: 'Des professionnels engagés pour une agriculture durable et prospère au Burundi.',
        en: 'Passionate professionals committed to sustainable and prosperous agriculture in Burundi.',
      },
      members: updated,
    });
    setSaving(false);
    if (ok) {
      toast({ title: t.cms.saved });
      await reload();
    } else {
      toast({ title: t.cms.errorSave, variant: 'destructive' });
    }
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim() || !formRole.fr.trim()) return;

    let updated: CmsTeamMember[];
    if (editingIndex !== null) {
      updated = [...members];
      updated[editingIndex] = {
        ...updated[editingIndex],
        name: formName.trim(),
        role: { fr: formRole.fr.trim(), en: formRole.en.trim() || formRole.fr.trim() },
        bio: { fr: formBio.fr.trim(), en: formBio.en.trim() || formBio.fr.trim() },
        imageUrl: formImage.imageUrl,
        imageKey: formImage.imageKey,
        published: formPublished,
      };
    } else {
      const newMember: CmsTeamMember = {
        id: `team-${Date.now()}`,
        name: formName.trim(),
        role: { fr: formRole.fr.trim(), en: formRole.en.trim() || formRole.fr.trim() },
        bio: { fr: formBio.fr.trim(), en: formBio.en.trim() || formBio.fr.trim() },
        imageUrl: formImage.imageUrl,
        imageKey: formImage.imageKey,
        sortOrder: members.length + 1,
        published: formPublished,
      };
      updated = [...members, newMember];
    }

    setMembers(updated);
    setDialogOpen(false);
    await persist(updated);
  }

  async function deleteMember(index: number) {
    const updated = members.filter((_, i) => i !== index);
    setMembers(updated);
    await persist(updated);
  }

  async function move(index: number, direction: 'up' | 'down') {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= members.length) return;
    const updated = [...members];
    const [moved] = updated.splice(index, 1);
    updated.splice(target, 0, moved);
    const reordered = updated.map((m, i) => ({ ...m, sortOrder: i + 1 }));
    setMembers(reordered);
    await persist(reordered);
  }

  async function togglePublish(index: number) {
    const updated = [...members];
    updated[index] = { ...updated[index], published: !updated[index].published };
    setMembers(updated);
    await persist(updated);
  }

  return (
    <Card className="border-border/70 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-[#2F6B3F]" aria-hidden="true" />
          <h3 className="font-semibold">{t.cms.groupTeam}</h3>
        </div>
        <Button
          onClick={openNew}
          size="sm"
          className="bg-[#2F6B3F] text-white hover:bg-[#275A34]"
        >
          <Plus className="mr-1.5 h-4 w-4" /> {t.cms.addMember}
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{t.cms.teamIntro}</p>

      <div className="mt-4 space-y-3">
        {members.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t.cms.noMembers}</p>
        ) : (
          members.map((m, i) => {
            const photoSrc = resolveImage({ imageUrl: m.imageUrl, imageKey: m.imageKey || 'training' });
            return (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-card p-3.5 transition-all hover:border-[#2F6B3F]/40"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-border bg-secondary">
                    {photoSrc ? (
                      <img src={photoSrc} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm truncate">{m.name}</h4>
                      <span
                        className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          m.published !== false
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {m.published !== false ? t.cms.published : t.cms.hidden}
                      </span>
                    </div>
                    <p className="text-xs text-[#2F6B3F] truncate">{m.role.fr}</p>
                    {m.bio?.fr ? (
                      <p className="text-xs text-muted-foreground truncate max-w-md">{m.bio.fr}</p>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => move(i, 'up')}
                    disabled={i === 0 || saving}
                    title={t.cms.moveUp}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => move(i, 'down')}
                    disabled={i === members.length - 1 || saving}
                    title={t.cms.moveDown}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => togglePublish(i)}
                    disabled={saving}
                    title={m.published !== false ? t.cms.hidden : t.cms.published}
                  >
                    {m.published !== false ? <Eye className="h-4 w-4 text-emerald-600" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => openEdit(i)}
                    title={t.cms.edit}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={() => deleteMember(i)}
                    title={t.cms.remove}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingIndex !== null ? t.cms.editMember : t.cms.addMember}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleFormSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>{t.cms.memberName} *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex. Dr. Fabrice Nkurunziza"
                required
                maxLength={100}
              />
            </div>

            <BiInput
              label={t.cms.memberRole}
              value={formRole}
              onChange={setFormRole}
              maxLength={120}
              hint="Ex: Directeur Général / Managing Director"
            />

            <BiTextarea
              label={t.cms.memberBio}
              value={formBio}
              onChange={setFormBio}
              rows={2}
              maxLength={400}
            />

            <ImagePicker
              label={t.cms.memberPhoto}
              token={token}
              value={formImage}
              onChange={setFormImage}
            />

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label htmlFor="member-publish" className="cursor-pointer">
                {t.cms.visibleLabel}
              </Label>
              <Switch
                id="member-publish"
                checked={formPublished}
                onCheckedChange={setFormPublished}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                {t.cms.cancel}
              </Button>
              <Button
                type="submit"
                disabled={saving || !formName.trim() || !formRole.fr.trim()}
                className="bg-[#2F6B3F] text-white hover:bg-[#275A34]"
              >
                {saving ? t.cms.saving : t.cms.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// --- Partners group ---------------------------------------------------------

function PartnersGroup({ token, initial, reload }: GroupProps & { initial: CmsSettings['partners'] }) {
  const { t, lang } = useSite();
  const { toast } = useToast();
  const [items, setItems] = useState<CmsPartner[]>(initial?.items ? [...initial.items] : []);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState<IText>({ fr: '', en: '' });
  const [formWebsite, setFormWebsite] = useState('');
  const [formLogo, setFormLogo] = useState<ImageValue>({ imageKey: 'training', imageUrl: null });
  const [formPublished, setFormPublished] = useState(true);

  function openNew() {
    setEditingIndex(null);
    setFormName('');
    setFormDescription({ fr: '', en: '' });
    setFormWebsite('');
    setFormLogo({ imageKey: 'training', imageUrl: null });
    setFormPublished(true);
    setDialogOpen(true);
  }

  function openEdit(index: number) {
    const p = items[index];
    if (!p) return;
    setEditingIndex(index);
    setFormName(p.name);
    setFormDescription(p.description ? { fr: p.description.fr, en: p.description.en } : { fr: '', en: '' });
    setFormWebsite(p.websiteUrl || '');
    setFormLogo({ imageKey: p.logoKey || 'training', imageUrl: p.logoUrl || null });
    setFormPublished(p.published !== false);
    setDialogOpen(true);
  }

  async function persist(updated: CmsPartner[]) {
    setSaving(true);
    const ok = await saveSetting(token, 'partners', {
      title: initial?.title || { fr: 'Nos Partenaires & Collaborateurs', en: 'Our Partners & Collaborators' },
      subtitle: initial?.subtitle || {
        fr: 'Ensemble pour promouvoir la myciculture et la fertilisation bio au Burundi.',
        en: 'Working together to promote mushroom farming and bio-organic fertilization in Burundi.',
      },
      items: updated,
    });
    setSaving(false);
    if (ok) {
      toast({ title: t.cms.saved });
      await reload();
    } else {
      toast({ title: t.cms.errorSave, variant: 'destructive' });
    }
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) return;

    let updated: CmsPartner[];
    if (editingIndex !== null) {
      updated = [...items];
      updated[editingIndex] = {
        ...updated[editingIndex],
        name: formName.trim(),
        description: { fr: formDescription.fr.trim(), en: formDescription.en.trim() || formDescription.fr.trim() },
        websiteUrl: formWebsite.trim(),
        logoUrl: formLogo.imageUrl,
        logoKey: formLogo.imageKey,
        published: formPublished,
      };
    } else {
      const newPartner: CmsPartner = {
        id: `partner-${Date.now()}`,
        name: formName.trim(),
        description: { fr: formDescription.fr.trim(), en: formDescription.en.trim() || formDescription.fr.trim() },
        websiteUrl: formWebsite.trim(),
        logoUrl: formLogo.imageUrl,
        logoKey: formLogo.imageKey,
        sortOrder: items.length + 1,
        published: formPublished,
      };
      updated = [...items, newPartner];
    }

    setItems(updated);
    setDialogOpen(false);
    await persist(updated);
  }

  async function deletePartner(index: number) {
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
    await persist(updated);
  }

  async function move(index: number, direction: 'up' | 'down') {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= items.length) return;
    const updated = [...items];
    const [moved] = updated.splice(index, 1);
    updated.splice(target, 0, moved);
    const reordered = updated.map((p, i) => ({ ...p, sortOrder: i + 1 }));
    setItems(reordered);
    await persist(reordered);
  }

  async function togglePublish(index: number) {
    const updated = [...items];
    updated[index] = { ...updated[index], published: !updated[index].published };
    setItems(updated);
    await persist(updated);
  }

  return (
    <Card className="border-border/70 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Handshake className="h-5 w-5 text-[#2F6B3F]" aria-hidden="true" />
          <h3 className="font-semibold">{t.cms.groupPartners}</h3>
        </div>
        <Button
          onClick={openNew}
          size="sm"
          className="bg-[#2F6B3F] text-white hover:bg-[#275A34]"
        >
          <Plus className="mr-1.5 h-4 w-4" /> {t.cms.addPartner}
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{t.cms.partnersIntro}</p>

      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t.cms.noPartners}</p>
        ) : (
          items.map((p, i) => {
            const logoSrc = p.logoUrl || (p.logoKey ? resolveImage({ imageKey: p.logoKey }) : null);
            return (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-card p-3.5 transition-all hover:border-[#2F6B3F]/40"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-14 shrink-0 overflow-hidden rounded-md border border-border bg-secondary flex items-center justify-center p-1">
                    {logoSrc ? (
                      <img src={logoSrc} alt="" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <Handshake className="h-5 w-5 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm truncate">{p.name}</h4>
                      <span
                        className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          p.published !== false
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {p.published !== false ? t.cms.published : t.cms.hidden}
                      </span>
                    </div>
                    {p.description?.fr ? (
                      <p className="text-xs text-muted-foreground truncate max-w-md">{p.description.fr}</p>
                    ) : null}
                    {p.websiteUrl ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[#2F6B3F] hover:underline">
                        <Globe className="h-3 w-3" />
                        <span className="truncate max-w-[200px]">{p.websiteUrl}</span>
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => move(i, 'up')}
                    disabled={i === 0 || saving}
                    title={t.cms.moveUp}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => move(i, 'down')}
                    disabled={i === items.length - 1 || saving}
                    title={t.cms.moveDown}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => togglePublish(i)}
                    disabled={saving}
                    title={p.published !== false ? t.cms.hidden : t.cms.published}
                  >
                    {p.published !== false ? <Eye className="h-4 w-4 text-emerald-600" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => openEdit(i)}
                    title={t.cms.edit}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={() => deletePartner(i)}
                    title={t.cms.remove}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingIndex !== null ? t.cms.editPartner : t.cms.addPartner}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleFormSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>{t.cms.partnerName} *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex. CAPAD Burundi"
                required
                maxLength={100}
              />
            </div>

            <ImagePicker
              label={t.cms.partnerLogo}
              token={token}
              value={formLogo}
              onChange={setFormLogo}
              uploadLabel="Upload logo"
            />

            <BiInput
              label={t.cms.partnerDescription}
              value={formDescription}
              onChange={setFormDescription}
              maxLength={150}
              hint="Ex: Coopérative agricole partenaire / Partner agricultural cooperative"
            />

            <div className="space-y-1.5">
              <Label>{t.cms.partnerWebsite}</Label>
              <Input
                type="url"
                value={formWebsite}
                onChange={(e) => setFormWebsite(e.target.value)}
                placeholder="https://example.org"
                maxLength={255}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label htmlFor="partner-publish" className="cursor-pointer">
                {t.cms.visibleLabel}
              </Label>
              <Switch
                id="partner-publish"
                checked={formPublished}
                onCheckedChange={setFormPublished}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                {t.cms.cancel}
              </Button>
              <Button
                type="submit"
                disabled={saving || !formName.trim()}
                className="bg-[#2F6B3F] text-white hover:bg-[#275A34]"
              >
                {saving ? t.cms.saving : t.cms.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// --- Security / Passcode group ----------------------------------------------

function SecurityGroup({ token }: { token: string }) {
  const { t } = useSite();
  const { toast } = useToast();
  const [currentPasscode, setCurrentPasscode] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [updating, setUpdating] = useState(false);

  async function onUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (newPasscode.length < 12) {
      toast({ title: t.cms.errorSave, description: t.cms.passcodeTooShort, variant: 'destructive' });
      return;
    }
    if (newPasscode !== confirmPasscode) {
      toast({ title: t.cms.errorSave, description: t.cms.passcodeMismatch, variant: 'destructive' });
      return;
    }

    setUpdating(true);
    try {
      const res = await fetch('/api/admin/change-passcode', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ currentPasscode, newPasscode }),
      });
      const data = await res.json().catch(() => null);

      if (res.ok) {
        toast({ title: t.cms.passcodeUpdated });
        setCurrentPasscode('');
        setNewPasscode('');
        setConfirmPasscode('');
      } else {
        toast({
          title: t.cms.errorSave,
          description: data?.error || t.cms.passcodeUpdateError,
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: t.cms.errorSave, description: t.cms.passcodeUpdateError, variant: 'destructive' });
    } finally {
      setUpdating(false);
    }
  }

  return (
    <Card className="border-border/70 p-6" data-tour="admin-security">
      <div className="flex items-center gap-2">
        <Lock className="h-5 w-5 text-[#2F6B3F]" aria-hidden="true" />
        <h3 className="font-semibold">{t.cms.groupSecurity}</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{t.cms.securityIntro}</p>

      <form onSubmit={onUpdate} className="mt-4 space-y-4 max-w-lg">
        <div className="space-y-1">
          <Label htmlFor="current-passcode">{t.cms.currentPasscodeLabel}</Label>
          <Input
            id="current-passcode"
            type="password"
            value={currentPasscode}
            onChange={(e) => setCurrentPasscode(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="new-passcode">{t.cms.newPasscodeLabel}</Label>
          <Input
            id="new-passcode"
            type="password"
            value={newPasscode}
            onChange={(e) => setNewPasscode(e.target.value)}
            required
            minLength={12}
            autoComplete="new-password"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="confirm-passcode">{t.cms.confirmPasscodeLabel}</Label>
          <Input
            id="confirm-passcode"
            type="password"
            value={confirmPasscode}
            onChange={(e) => setConfirmPasscode(e.target.value)}
            required
            minLength={12}
            autoComplete="new-password"
          />
        </div>

        <div className="pt-2">
          <Button
            type="submit"
            disabled={updating || !currentPasscode || !newPasscode || !confirmPasscode}
            className="bg-[#2F6B3F] text-white hover:bg-[#275A34]"
          >
            {updating ? t.cms.saving : t.cms.updatePasscodeBtn}
          </Button>
        </div>
      </form>
    </Card>
  );
}

// --- Recovery code group ----------------------------------------------------

/**
 * Issues the code that gets the owner back in after a forgotten passcode.
 *
 * The current passcode is required even though the session token is already
 * valid: a stolen token must not be enough to mint a credential that outlives
 * the session and survives a later passcode change.
 */
function RecoveryGroup({ token }: { token: string }) {
  const { t } = useSite();
  const { toast } = useToast();
  const [passcode, setPasscode] = useState('');
  const [generating, setGenerating] = useState(false);
  const [issued, setIssued] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function onGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    try {
      const res = await fetch('/api/admin/recovery-code', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ passcode }),
      });
      const data = (await res.json().catch(() => null)) as { recoveryCode?: string; error?: string } | null;

      if (res.ok && data?.recoveryCode) {
        setIssued(data.recoveryCode);
        setPasscode('');
        setCopied(false);
        toast({ title: t.cms.recoveryGenerated });
      } else {
        toast({
          title: t.cms.errorSave,
          description: data?.error || t.cms.recoveryFailed,
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: t.cms.errorSave, description: t.cms.recoveryFailed, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  }

  async function copyCode() {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued);
      setCopied(true);
    } catch {
      /* clipboard unavailable — the code is on screen to be written down */
    }
  }

  return (
    <Card className="border-border/70 p-6">
      <div className="flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-[#2F6B3F]" aria-hidden="true" />
        <h3 className="font-semibold">{t.cms.recoveryGroupTitle}</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{t.cms.recoveryIntro}</p>

      <form onSubmit={onGenerate} className="mt-4 space-y-4 max-w-lg">
        <div className="space-y-1">
          <Label htmlFor="recovery-current-passcode">{t.cms.recoveryRequiresPasscode}</Label>
          <Input
            id="recovery-current-passcode"
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <Button
          type="submit"
          disabled={generating || !passcode}
          className="bg-[#2F6B3F] text-white hover:bg-[#275A34]"
        >
          {generating ? t.cms.saving : t.cms.recoveryGenerateBtn}
        </Button>
      </form>

      {issued ? (
        <div className="mt-5 max-w-lg rounded-md border border-[#2F6B3F]/40 bg-secondary/40 p-4">
          <p className="text-sm text-muted-foreground">{t.cms.recoveryShownOnce}</p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 select-all break-all font-mono text-base tracking-widest">{issued}</code>
            <Button type="button" variant="outline" size="sm" onClick={copyCode}>
              {copied ? t.admin.copied : t.admin.copy}
            </Button>
          </div>
          <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={() => setIssued(null)}>
            {t.cms.recoverySaved}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

// --- Panel ------------------------------------------------------------------

export function SettingsPanel({ token, content, reload }: { token: string; content: AdminContent; reload: () => Promise<void> }) {
  const { t } = useSite();
  const { settings } = content;

  return (
    <div className="space-y-5" data-tour="admin-content">
      <p className="text-sm text-muted-foreground">{t.cms.contentIntro}</p>
      <ContactGroup key={`contact-${JSON.stringify(settings.contact)}`} token={token} initial={settings.contact} reload={reload} />
      <HomeGroup key={`home-${JSON.stringify(settings.home)}`} token={token} initial={settings.home} reload={reload} />
      <TeamGroup key={`team-${JSON.stringify(settings.team)}`} token={token} initial={settings.team} reload={reload} />
      <PartnersGroup key={`partners-${JSON.stringify(settings.partners)}`} token={token} initial={settings.partners} reload={reload} />
      <TrainingGroup key={`training-${JSON.stringify(settings.training)}`} token={token} initial={settings.training} reload={reload} />
      <AboutGroup key={`about-${JSON.stringify(settings.about)}`} token={token} initial={settings.about} reload={reload} />
      <SustainabilityGroup
        key={`sustainability-${JSON.stringify(settings.sustainability)}`}
        token={token}
        initial={settings.sustainability}
        reload={reload}
      />
      <SecurityGroup token={token} />
      <RecoveryGroup token={token} />
    </div>
  );
}
