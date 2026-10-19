'use client';

// Inquiries panel — the original team dashboard (stats + inquiry table),
// now presented as one tab of the admin area.

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSite } from './context';
import { authHeaders } from './admin-ui';
import { Eye, FileDown, RefreshCw, Users } from 'lucide-react';
import type { Dict } from '@/lib/i18n';

interface InquiryRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  type: string;
  product: string | null;
  message: string;
  lang: string;
  status: string;
  createdAt: string;
}

interface AdminData {
  inquiries: InquiryRow[];
  stats: {
    total: number;
    newCount: number;
    pageviews: number;
    byType: Record<string, number>;
    topPages: { path: string; count: number }[];
  };
}

const TYPE_KEYS: (keyof Dict['form']['subjects'])[] = ['product', 'bulk', 'fertilizer', 'training', 'partnership'];

export function InquiriesPanel({ token }: { token: string }) {
  const { t, lang } = useSite();
  const [data, setData] = useState<AdminData | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (tok: string) => {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/data', { headers: { 'x-admin-token': tok } });
        if (!res.ok) throw new Error();
        setData(await res.json());
      } catch {
        // keep previous data; the shell handles auth errors
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    load(token);
  }, [token, load]);

  async function toggleStatus(row: InquiryRow) {
    if (!data) return;
    const next = row.status === 'new' ? 'handled' : 'new';
    const res = await fetch('/api/admin/data', {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ id: row.id, status: next }),
    });
    if (res.ok) {
      setData({
        ...data,
        inquiries: data.inquiries.map((r) => (r.id === row.id ? { ...r, status: next } : r)),
        stats: {
          ...data.stats,
          newCount: data.stats.newCount + (next === 'new' ? 1 : -1),
        },
      });
    }
  }

  function exportCsv() {
    if (!data) return;
    const header = ['id', 'date', 'name', 'phone', 'email', 'subject', 'product', 'language', 'status', 'message'];
    const rows = data.inquiries.map((r) => [
      r.id,
      new Date(r.createdAt).toISOString(),
      r.name,
      r.phone,
      r.email ?? '',
      r.type,
      r.product ?? '',
      r.lang,
      r.status,
      r.message.replace(/\r?\n/g, ' '),
    ]);
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((r) => r.map(esc).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mycofert-inquiries-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = data?.inquiries.filter((r) => filter === 'all' || r.type === filter) ?? [];

  return (
    <div>
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/70 p-5">
          <Users className="h-6 w-6 text-[#2F6B3F]" aria-hidden="true" />
          <p className="mt-2 text-3xl font-extrabold">{data?.stats.total ?? '–'}</p>
          <p className="text-sm text-muted-foreground">{t.admin.statTotal}</p>
        </Card>
        <Card className="border-border/70 p-5">
          <Badge className="h-6 w-fit bg-[#6FA84C] text-white hover:bg-[#6FA84C]">{data?.stats.newCount ?? '–'}</Badge>
          <p className="mt-2 text-sm font-medium">{t.admin.statNew}</p>
        </Card>
        <Card className="border-border/70 p-5">
          <Eye className="h-6 w-6 text-[#2F6B3F]" aria-hidden="true" />
          <p className="mt-2 text-3xl font-extrabold">{data?.stats.pageviews ?? '–'}</p>
          <p className="text-sm text-muted-foreground">{t.admin.statPageviews}</p>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="border-border/70 p-5">
          <h2 className="font-semibold">{t.admin.byType}</h2>
          <ul className="mt-3 space-y-2">
            {TYPE_KEYS.map((k) => (
              <li key={k} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t.form.subjects[k]}</span>
                <Badge variant="secondary">{data?.stats.byType[k] ?? 0}</Badge>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="border-border/70 p-5">
          <h2 className="font-semibold">{t.admin.statTop}</h2>
          <ul className="mt-3 space-y-2">
            {(data?.stats.topPages ?? []).map((p) => (
              <li key={p.path} className="flex items-center justify-between text-sm">
                <span className="font-mono text-muted-foreground">{p.path}</span>
                <Badge variant="secondary">{p.count}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Inquiries table */}
      <div className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t.admin.inquiriesTitle}</h2>
          <div className="flex gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-44" aria-label={t.admin.colSubject}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.admin.filterAll}</SelectItem>
                {TYPE_KEYS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {t.form.subjects[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => load(token)} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <FileDown className="mr-2 h-4 w-4" aria-hidden="true" /> {t.admin.exportCsv}
            </Button>
          </div>
        </div>

        <Card className="mt-4 overflow-hidden border-border/70">
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>{t.admin.colDate}</TableHead>
                  <TableHead>{t.admin.colName}</TableHead>
                  <TableHead>{t.admin.colPhone}</TableHead>
                  <TableHead>{t.admin.colSubject}</TableHead>
                  <TableHead>{t.admin.colMessage}</TableHead>
                  <TableHead>{t.admin.langCol}</TableHead>
                  <TableHead>{t.admin.colStatus}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      {t.admin.noData}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(r.createdAt).toLocaleString(lang === 'en' ? 'en-GB' : 'fr-FR')}
                      </TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{r.phone}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="whitespace-nowrap">
                          {r.type in t.form.subjects
                            ? t.form.subjects[r.type as keyof typeof t.form.subjects]
                            : r.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-64 text-sm text-muted-foreground">
                        <span className="line-clamp-2">{r.message}</span>
                      </TableCell>
                      <TableCell>
                        <span className="uppercase text-xs">{r.lang}</span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleStatus(r)}
                          className={
                            r.status === 'new'
                              ? 'border-[#6FA84C]/50 text-[#2F6B3F] hover:bg-[#6FA84C]/10'
                              : ''
                          }
                        >
                          {r.status === 'new' ? t.admin.markHandled : t.admin.markNew}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
