'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useSite } from './context';
import { useCms, pick } from './cms';
import { Send } from 'lucide-react';

export type InquiryType = 'product' | 'bulk' | 'fertilizer' | 'training' | 'partnership';

const TYPES: InquiryType[] = ['product', 'bulk', 'fertilizer', 'training', 'partnership'];

export function InquiryForm({
  defaultType = 'product',
  defaultProduct,
  compact = false,
}: {
  defaultType?: InquiryType;
  defaultProduct?: string;
  compact?: boolean;
}) {
  const { t, lang } = useSite();
  const { products } = useCms();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [type, setType] = useState<InquiryType>(() => {
    if (typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search).get('type');
      if (q && (TYPES as string[]).includes(q)) return q as InquiryType;
    }
    return defaultType;
  });
  const [product, setProduct] = useState<string>(defaultProduct ?? 'none');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [phoneError, setPhoneError] = useState(false);
  // Honeypot: hidden from humans via CSS, filled in by naive bots.
  const [website, setWebsite] = useState('');

  const productOptions = useMemo(
    () => products.map((p) => ({ id: p.slug, name: pick(p.name, lang) })),
    [products, lang]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedPhone = phone.trim();
    if (trimmedPhone.replace(/[^\d]/g, '').length < 7) {
      setPhoneError(true);
      return;
    }
    setPhoneError(false);
    setSending(true);
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: trimmedPhone,
          email: email.trim() || null,
          type,
          product: product !== 'none' ? product : null,
          message: message.trim(),
          lang,
          website,
        }),
      });
      if (!res.ok) throw new Error('request failed');
      toast({ title: t.form.successTitle, description: t.form.successBody });
      setName('');
      setPhone('');
      setEmail('');
      setProduct('none');
      setMessage('');
      setWebsite('');
    } catch {
      toast({
        title: t.form.errorTitle,
        description: t.form.errorBody,
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={compact ? 'space-y-4' : 'grid gap-4 sm:grid-cols-2'}>
      {/* Honeypot — hidden from users and assistive tech, tempting to bots. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="inq-website">Website</label>
        <input
          id="inq-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="inq-name">{t.form.name} *</Label>
        <Input
          id="inq-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.form.namePlaceholder}
          required
          maxLength={200}
          autoComplete="name"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="inq-phone" aria-invalid={phoneError}>
          {t.form.phone} *
        </Label>
        <Input
          id="inq-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t.form.phonePlaceholder}
          required
          maxLength={50}
          autoComplete="tel"
          aria-invalid={phoneError}
        />
        {phoneError ? <p className="text-xs text-destructive">{t.form.invalidPhone}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="inq-email">{t.form.email}</Label>
        <Input
          id="inq-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.form.emailPlaceholder}
          maxLength={200}
          autoComplete="email"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="inq-type">{t.form.subject} *</Label>
        <Select value={type} onValueChange={(v) => setType(v as InquiryType)} required>
          <SelectTrigger id="inq-type">
            <SelectValue placeholder={t.form.subject} />
          </SelectTrigger>
          <SelectContent>
            {TYPES.map((tp) => (
              <SelectItem key={tp} value={tp}>
                {t.form.subjects[tp]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className={`space-y-2 ${compact ? '' : 'sm:col-span-2'}`}>
        <Label htmlFor="inq-product">{t.form.product}</Label>
        <Select value={product} onValueChange={setProduct}>
          <SelectTrigger id="inq-product">
            <SelectValue placeholder={t.form.productPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t.form.productNone}</SelectItem>
            {productOptions.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className={`space-y-2 ${compact ? '' : 'sm:col-span-2'}`}>
        <Label htmlFor="inq-message">{t.form.message} *</Label>
        <Textarea
          id="inq-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t.form.messagePlaceholder}
          required
          rows={4}
          maxLength={4000}
        />
      </div>
      <div className={compact ? '' : 'sm:col-span-2'}>
        <Button
          type="submit"
          disabled={sending}
          className="w-full bg-[#2F6B3F] text-white hover:bg-[#275A34] sm:w-auto"
        >
          <Send className="mr-2 h-4 w-4" aria-hidden="true" />
          {sending ? t.form.submitting : t.form.submit}
        </Button>
      </div>
    </form>
  );
}
