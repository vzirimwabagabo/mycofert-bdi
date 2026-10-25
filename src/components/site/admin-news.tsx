'use client';

// News panel — the owner can publish, edit, hide and delete news articles.
// Articles appear on the News page, the homepage teaser, and get their own
// detail page. Every text field is bilingual.

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useSite } from './context';
import { BiInput, BiTextarea, ImagePicker, authHeaders, type AdminContent } from './admin-ui';
import { resolveImage, slugify, type CmsNews, type IText } from '@/lib/cms-defaults';
import { CalendarDays, Newspaper, Pencil, Plus, Trash2 } from 'lucide-react';

interface NewsForm {
  slug: string;
  imageKey: string;
  imageUrl: string | null;
  published: boolean;
  date: IText;
  title: IText;
  excerpt: IText;
  body: IText;
}

function toForm(n: CmsNews): NewsForm {
  return {
    slug: n.slug,
    imageKey: n.imageKey,
    imageUrl: n.imageUrl ?? null,
    published: n.published,
    date: { ...n.date },
    title: { ...n.title },
    excerpt: { ...n.excerpt },
    body: { fr: n.body.fr.join('\n\n'), en: n.body.en.join('\n\n') },
  };
}

function emptyForm(): NewsForm {
  const now = new Date();
  const label = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const labelEn = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  return {
    slug: '',
    imageKey: 'training',
    imageUrl: null,
    published: true,
    date: { fr: label.charAt(0).toUpperCase() + label.slice(1), en: labelEn.charAt(0).toUpperCase() + labelEn.slice(1) },
    title: { fr: '', en: '' },
    excerpt: { fr: '', en: '' },
    body: { fr: '', en: '' },
  };
}

function toPayload(f: NewsForm) {
  return {
    slug: f.slug,
    imageKey: f.imageKey,
    imageUrl: f.imageUrl,
    published: f.published,
    dateFr: f.date.fr,
    dateEn: f.date.en,
    titleFr: f.title.fr,
    titleEn: f.title.en,
    excerptFr: f.excerpt.fr,
    excerptEn: f.excerpt.en,
    bodyFr: f.body.fr,
    bodyEn: f.body.en,
  };
}

export function NewsPanel({
  token,
  content,
  reload,
}: {
  token: string;
  content: AdminContent;
  reload: () => Promise<void>;
}) {
  const { t } = useSite();
  const { toast } = useToast();
  const [editing, setEditing] = useState<{ mode: 'new' | 'edit'; post?: CmsNews } | null>(null);
  const [form, setForm] = useState<NewsForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CmsNews | null>(null);

  function openNew() {
    setEditing({ mode: 'new' });
    setForm(emptyForm());
  }

  function openEdit(post: CmsNews) {
    setEditing({ mode: 'edit', post });
    setForm(toForm(post));
  }

  async function save() {
    if (!form || !editing) return;
    if (!form.title.fr.trim()) {
      toast({ title: t.cms.errorSave, description: t.cms.fieldTitle, variant: 'destructive' });
      return;
    }
    const slug = slugify(form.slug || form.title.fr);
    if (!slug) {
      toast({ title: t.cms.errorSave, description: t.cms.fieldSlugHint, variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/content', {
        method: editing.mode === 'new' ? 'POST' : 'PATCH',
        headers: authHeaders(token),
        body: JSON.stringify(
          editing.mode === 'new'
            ? { kind: 'news', data: { ...toPayload(form), slug } }
            : { kind: 'news', id: editing.post?.id, data: { ...toPayload(form), slug } }
        ),
      });
      if (res.status === 409) {
        toast({ title: t.cms.errorSave, description: t.cms.duplicateSlug, variant: 'destructive' });
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      toast({ title: t.cms.saved });
      setEditing(null);
      setForm(null);
      await reload();
    } catch {
      toast({ title: t.cms.errorSave, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(post: CmsNews, next: boolean) {
    const res = await fetch('/api/admin/content', {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ kind: 'news', id: post.id, data: { published: next } }),
    });
    if (res.ok) await reload();
    else toast({ title: t.cms.errorSave, variant: 'destructive' });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const res = await fetch(`/api/admin/content?kind=news&id=${encodeURIComponent(deleteTarget.id)}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    setDeleteTarget(null);
    if (res.ok) {
      toast({ title: t.cms.saved });
      await reload();
    } else {
      toast({ title: t.cms.errorSave, variant: 'destructive' });
    }
  }

  return (
    <div data-tour="admin-news">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t.cms.newsTitle}</h2>
          <p className="text-sm text-muted-foreground">{t.cms.newsIntro}</p>
        </div>
        <Button onClick={openNew} className="bg-[#2F6B3F] text-white hover:bg-[#275A34]">
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" /> {t.cms.add}
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {content.news.length === 0 ? (
          <Card className="border-border/70 p-10 text-center text-muted-foreground">{t.cms.empty}</Card>
        ) : (
          content.news.map((post) => (
            <Card key={post.id} className="flex flex-wrap items-center gap-4 border-border/70 p-4">
              <img
                src={resolveImage(post)}
                alt=""
                aria-hidden="true"
                className="h-14 w-20 shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-40 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{post.title.fr}</p>
                  {post.published ? (
                    <Badge variant="secondary" className="bg-[#6FA84C]/15 text-[#2F6B3F]">
                      {t.cms.published}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">{t.cms.hidden}</Badge>
                  )}
                </div>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarDays className="h-3 w-3" aria-hidden="true" /> {post.date.fr} ·
                  <span className="font-mono">/{post.slug}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={post.published}
                  onCheckedChange={(v) => togglePublished(post, v)}
                  aria-label={`${t.cms.visibleLabel}: ${post.title.fr}`}
                />
                <span className="hidden text-xs text-muted-foreground sm:inline">{t.cms.visibleLabel}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(post)}>
                  <Pencil className="mr-2 h-4 w-4" aria-hidden="true" /> {t.cms.edit}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteTarget(post)}
                >
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" /> {t.cms.remove}
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Edit / create dialog */}
      <Dialog open={editing !== null} onOpenChange={(open) => (!open ? setEditing(null) : null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Newspaper className="h-5 w-5 text-[#2F6B3F]" aria-hidden="true" />
              {editing?.mode === 'new' ? t.cms.newNews : t.cms.editNews}
            </DialogTitle>
            <DialogDescription>{t.cms.contentIntro}</DialogDescription>
          </DialogHeader>

          {form ? (
            <div className="space-y-4">
              <ImagePicker
                label={t.cms.fieldImage}
                token={token}
                value={{ imageKey: form.imageKey, imageUrl: form.imageUrl }}
                onChange={(v) => setForm({ ...form, imageKey: v.imageKey, imageUrl: v.imageUrl })}
              />

              <div className="flex items-center gap-3">
                <Switch
                  id="news-published"
                  checked={form.published}
                  onCheckedChange={(published) => setForm({ ...form, published })}
                />
                <Label htmlFor="news-published">{t.cms.visibleLabel}</Label>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="news-slug">{t.cms.fieldSlug}</Label>
                <Input
                  id="news-slug"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder={t.cms.fieldSlugHint}
                  maxLength={60}
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-7 items-center justify-center rounded bg-[#2F6B3F] text-[10px] font-bold text-white">
                      FR
                    </span>
                    {t.cms.fieldDate}
                  </Label>
                  <Input
                    value={form.date.fr}
                    onChange={(e) => setForm({ ...form, date: { ...form.date, fr: e.target.value } })}
                    maxLength={60}
                    aria-label={`${t.cms.fieldDate} (FR)`}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-7 items-center justify-center rounded bg-[#8B5A2B] text-[10px] font-bold text-white">
                      EN
                    </span>
                    {t.cms.fieldDate}
                  </Label>
                  <Input
                    value={form.date.en}
                    onChange={(e) => setForm({ ...form, date: { ...form.date, en: e.target.value } })}
                    maxLength={60}
                    aria-label={`${t.cms.fieldDate} (EN)`}
                  />
                </div>
              </div>

              <BiInput
                label={t.cms.fieldTitle}
                value={form.title}
                onChange={(title) => setForm({ ...form, title })}
                maxLength={200}
              />
              <BiTextarea
                label={t.cms.fieldExcerpt}
                value={form.excerpt}
                onChange={(excerpt) => setForm({ ...form, excerpt })}
                rows={2}
              />
              <BiTextarea
                label={t.cms.fieldBody}
                value={form.body}
                onChange={(body) => setForm({ ...form, body })}
                hint={t.cms.fieldBodyHint}
                rows={8}
                maxLength={40000}
              />
            </div>
          ) : null}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>
              {t.cms.cancel}
            </Button>
            <Button onClick={save} disabled={saving} className="bg-[#2F6B3F] text-white hover:bg-[#275A34]">
              {saving ? t.cms.saving : t.cms.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => (!open ? setDeleteTarget(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.cms.confirmDeleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.cms.confirmDeleteBody}
              {deleteTarget ? ` — « ${deleteTarget.title.fr} »` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cms.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {t.cms.remove}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
