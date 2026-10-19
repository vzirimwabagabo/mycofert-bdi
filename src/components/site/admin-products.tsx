'use client';

// Products panel — the owner can add, edit, hide, reorder and delete the
// products displayed on the public website. Every text field is bilingual.

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
import { imageSrc, slugify, type CmsProduct, type IText } from '@/lib/cms-defaults';
import { ArrowDown, ArrowUp, Package, Pencil, Plus, Trash2 } from 'lucide-react';

interface ProductForm {
  slug: string;
  imageKey: string;
  published: boolean;
  sortOrder: number;
  name: IText;
  tagline: IText;
  description: IText;
  points: IText;
  formats: IText;
}

function toForm(p: CmsProduct): ProductForm {
  return {
    slug: p.slug,
    imageKey: p.imageKey,
    published: p.published,
    sortOrder: p.sortOrder,
    name: { ...p.name },
    tagline: { ...p.tagline },
    description: { ...p.description },
    points: { fr: p.points.fr.join('\n'), en: p.points.en.join('\n') },
    formats: { ...p.formats },
  };
}

function emptyForm(sortOrder: number): ProductForm {
  return {
    slug: '',
    imageKey: 'fresh',
    published: true,
    sortOrder,
    name: { fr: '', en: '' },
    tagline: { fr: '', en: '' },
    description: { fr: '', en: '' },
    points: { fr: '', en: '' },
    formats: { fr: '', en: '' },
  };
}

function toPayload(f: ProductForm) {
  return {
    slug: f.slug,
    imageKey: f.imageKey,
    published: f.published,
    sortOrder: f.sortOrder,
    nameFr: f.name.fr,
    nameEn: f.name.en,
    taglineFr: f.tagline.fr,
    taglineEn: f.tagline.en,
    descFr: f.description.fr,
    descEn: f.description.en,
    pointsFr: f.points.fr,
    pointsEn: f.points.en,
    formatsFr: f.formats.fr,
    formatsEn: f.formats.en,
  };
}

export function ProductsPanel({
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
  const [editing, setEditing] = useState<{ mode: 'new' | 'edit'; product?: CmsProduct } | null>(null);
  const [form, setForm] = useState<ProductForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CmsProduct | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);

  const products = content.products;

  function openNew() {
    const maxOrder = products.reduce((max, p) => Math.max(max, p.sortOrder), 0);
    setEditing({ mode: 'new' });
    setForm(emptyForm(maxOrder + 10));
    setSlugTouched(false);
  }

  function openEdit(product: CmsProduct) {
    setEditing({ mode: 'edit', product });
    setForm(toForm(product));
    setSlugTouched(true);
  }

  async function save() {
    if (!form || !editing) return;
    if (!form.name.fr.trim()) {
      toast({ title: t.cms.errorSave, description: t.cms.fieldName, variant: 'destructive' });
      return;
    }
    const slug = slugify(form.slug || form.name.fr);
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
            ? { kind: 'product', data: { ...toPayload(form), slug } }
            : { kind: 'product', id: editing.product?.id, data: { ...toPayload(form), slug } }
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

  async function togglePublished(product: CmsProduct, next: boolean) {
    const res = await fetch('/api/admin/content', {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ kind: 'product', id: product.id, data: { published: next } }),
    });
    if (res.ok) await reload();
    else toast({ title: t.cms.errorSave, variant: 'destructive' });
  }

  async function move(index: number, dir: -1 | 1) {
    const other = products[index + dir];
    const current = products[index];
    if (!other || !current) return;
    try {
      const res1 = await fetch('/api/admin/content', {
        method: 'PATCH',
        headers: authHeaders(token),
        body: JSON.stringify({ kind: 'product', id: current.id, data: { sortOrder: other.sortOrder } }),
      });
      const res2 = await fetch('/api/admin/content', {
        method: 'PATCH',
        headers: authHeaders(token),
        body: JSON.stringify({ kind: 'product', id: other.id, data: { sortOrder: current.sortOrder } }),
      });
      if (!res1.ok || !res2.ok) throw new Error();
      await reload();
    } catch {
      toast({ title: t.cms.errorSave, variant: 'destructive' });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const res = await fetch(`/api/admin/content?kind=product&id=${encodeURIComponent(deleteTarget.id)}`, {
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
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t.cms.productsTitle}</h2>
          <p className="text-sm text-muted-foreground">{t.cms.productsIntro}</p>
        </div>
        <Button onClick={openNew} className="bg-[#2F6B3F] text-white hover:bg-[#275A34]">
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" /> {t.cms.add}
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {products.length === 0 ? (
          <Card className="border-border/70 p-10 text-center text-muted-foreground">{t.cms.empty}</Card>
        ) : (
          products.map((product, i) => (
            <Card key={product.id} className="flex flex-wrap items-center gap-4 border-border/70 p-4">
              <img
                src={imageSrc(product.imageKey)}
                alt=""
                aria-hidden="true"
                className="h-14 w-20 shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-40 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{product.name.fr}</p>
                  {product.published ? (
                    <Badge variant="secondary" className="bg-[#6FA84C]/15 text-[#2F6B3F]">
                      {t.cms.published}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">{t.cms.hidden}</Badge>
                  )}
                </div>
                <p className="font-mono text-xs text-muted-foreground">/{product.slug}</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={product.published}
                  onCheckedChange={(v) => togglePublished(product, v)}
                  aria-label={`${t.cms.visibleLabel}: ${product.name.fr}`}
                />
                <span className="hidden text-xs text-muted-foreground sm:inline">{t.cms.visibleLabel}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={t.cms.moveUp}
                >
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => move(i, 1)}
                  disabled={i === products.length - 1}
                  aria-label={t.cms.moveDown}
                >
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(product)}>
                  <Pencil className="mr-2 h-4 w-4" aria-hidden="true" /> {t.cms.edit}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteTarget(product)}
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
              <Package className="h-5 w-5 text-[#2F6B3F]" aria-hidden="true" />
              {editing?.mode === 'new' ? t.cms.newProduct : t.cms.editProduct}
            </DialogTitle>
            <DialogDescription>{t.cms.contentIntro}</DialogDescription>
          </DialogHeader>

          {form ? (
            <div className="space-y-4">
              <ImagePicker
                label={t.cms.fieldImage}
                value={form.imageKey}
                onChange={(imageKey) => setForm({ ...form, imageKey })}
              />

              <div className="flex items-center gap-3">
                <Switch
                  id="product-published"
                  checked={form.published}
                  onCheckedChange={(published) => setForm({ ...form, published })}
                />
                <Label htmlFor="product-published">{t.cms.visibleLabel}</Label>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="product-slug">{t.cms.fieldSlug}</Label>
                <Input
                  id="product-slug"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setForm({ ...form, slug: e.target.value });
                  }}
                  onBlur={() => {
                    if (!slugTouched || !form.slug) {
                      setForm({ ...form, slug: slugify(form.slug || form.name.fr) });
                    }
                  }}
                  placeholder={t.cms.fieldSlugHint}
                  maxLength={60}
                />
                <p className="text-xs text-muted-foreground">{t.cms.fieldSlugHint}</p>
              </div>

              <BiInput
                label={t.cms.fieldName}
                value={form.name}
                onChange={(name) => setForm({ ...form, name })}
                maxLength={200}
              />
              <BiInput
                label={t.cms.fieldTagline}
                value={form.tagline}
                onChange={(tagline) => setForm({ ...form, tagline })}
                maxLength={300}
              />
              <BiTextarea
                label={t.cms.fieldDescription}
                value={form.description}
                onChange={(description) => setForm({ ...form, description })}
                rows={3}
              />
              <BiTextarea
                label={`${t.cms.fieldPoints} — ${t.cms.fieldPointsHint}`}
                value={form.points}
                onChange={(points) => setForm({ ...form, points })}
                rows={4}
              />
              <BiInput
                label={t.cms.fieldFormats}
                value={form.formats}
                onChange={(formats) => setForm({ ...form, formats })}
                maxLength={200}
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
              {deleteTarget ? ` — « ${deleteTarget.name.fr} »` : ''}
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
