import { useEffect, useState, useCallback } from 'react';
import { Save, AlertCircle, Settings as SettingsIcon } from 'lucide-react';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { FEE_GROUPS, FEE_CATEGORIES, UNITS } from '@/lib/constants';
import { FeeSetup } from '@/lib/types';

interface SetupRow {
  id?: string;
  fee_group: string;
  fee_category: string;
  unit_number: number;
}

interface FieldValues {
  amount: string;
  second_ward_amount: string;
  fine_amount: string;
  due_date: string;
}

function rowKey(r: { fee_group: string; fee_category: string; unit_number: number }): string {
  return `${r.fee_group}|${r.fee_category}|${r.unit_number}`;
}

export default function FeeSetupPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<SetupRow[]>([]);
  const [fields, setFields] = useState<Record<string, FieldValues>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSetups = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('fee_setup').select('*').eq('user_id', user.id);
    const existingSetups = (data ?? []) as FeeSetup[];

    const newRows: SetupRow[] = [];
    const newFields: Record<string, FieldValues> = {};

    FEE_GROUPS.forEach((group) => {
      FEE_CATEGORIES.forEach((category) => {
        UNITS.forEach((unit) => {
          const existing = existingSetups.find(
            (s) => s.fee_group === group.label &&
              s.fee_category === category &&
              s.unit_number === unit.number
          );
          const key = rowKey({ fee_group: group.label, fee_category: category, unit_number: unit.number });
          newRows.push({
            id: existing?.id,
            fee_group: group.label,
            fee_category: category,
            unit_number: unit.number,
          });
          newFields[key] = {
            amount: existing?.amount?.toString() ?? '',
            second_ward_amount: existing?.second_ward_amount?.toString() ?? '',
            fine_amount: existing?.fine_amount?.toString() ?? '',
            due_date: existing?.due_date ?? unit.defaultDue,
          };
        });
      });
    });

    setRows(newRows);
    setFields(newFields);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadSetups(); }, [loadSetups]);

  const updateField = (key: string, field: keyof FieldValues, value: string) => {
    setFields((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    const upserts = rows.map((row) => {
      const key = rowKey(row);
      const f = fields[key] ?? { amount: '', second_ward_amount: '', fine_amount: '', due_date: '' };
      const amount = f.amount ? parseFloat(f.amount) : null;
      const secondWard = f.second_ward_amount ? parseFloat(f.second_ward_amount) : null;
      const fine = f.fine_amount ? parseFloat(f.fine_amount) : null;

      const payload = {
        fee_group: row.fee_group,
        class: null,
        stream: null,
        subject_group: null,
        fee_category: row.fee_category,
        unit_number: row.unit_number,
        amount,
        second_ward_amount: secondWard,
        fine_amount: fine,
        due_date: f.due_date || null,
      };

      if (row.id) {
        return supabase.from('fee_setup').update(payload).eq('id', row.id);
      }
      return supabase.from('fee_setup').insert(payload);
    });

    const results = await Promise.all(upserts);
    const errors = results.filter((r) => r.error);
    if (errors.length > 0) {
      setError(errors[0].error!.message);
    } else {
      setSavedMessage(true);
      setTimeout(() => setSavedMessage(false), 3000);
      loadSetups();
    }
    setSaving(false);
  };

  const groupedRows: Record<string, SetupRow[]> = {};
  rows.forEach((r) => {
    if (!groupedRows[r.fee_group]) groupedRows[r.fee_group] = [];
    groupedRows[r.fee_group].push(r);
  });

  return (
    <Layout>
      <PageHeader
        title="Fee Setup"
        subtitle="Set fee amounts, 2nd ward amounts, fines, and due dates for each class group, category, and unit."
        action={
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save All'}
          </button>
        }
      />

      {savedMessage && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          <AlertCircle className="h-4 w-4" />
          Fee structure saved successfully!
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
        <div className="flex items-start gap-3">
          <SettingsIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium">How fee setup works:</p>
            <ul className="mt-2 space-y-1 text-blue-600 dark:text-blue-400">
              <li>• Fees are set per class group (e.g. Nursery to UKG, Class 1 to Class 2) — all classes in a group share the same fee</li>
              <li>• Class 11 & 12 has separate groups: Science (covers PCB & PCM) and Commerce/Humanities</li>
              <li>• Set fee amount, 2nd ward amount, fine, and due date for each category and unit (1-4)</li>
              <li>• The 2nd Ward Amount is the fee charged to students who are the second child from the same parents</li>
              <li>• Leave amount/fine blank if not applicable — treated as ₹0</li>
            </ul>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedRows).map(([groupKey, groupRows]) => (
            <div key={groupKey} className="card overflow-hidden">
              <div className="border-b border-gray-200 bg-gray-50 px-6 py-3 dark:border-gray-800 dark:bg-gray-800/50">
                <h3 className="font-semibold text-gray-900 dark:text-white">{groupKey}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">Category</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">Unit</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">Months</th>
                      <th className="px-4 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">Amount (₹)</th>
                      <th className="px-4 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">2nd Ward (₹)</th>
                      <th className="px-4 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">Fine (₹)</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">Due Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {groupRows.map((row) => {
                      const key = rowKey(row);
                      const f = fields[key] ?? { amount: '', second_ward_amount: '', fine_amount: '', due_date: '' };
                      const unitInfo = UNITS.find((u) => u.number === row.unit_number);
                      return (
                        <tr key={key} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                          <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{row.fee_category}</td>
                          <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">{unitInfo?.label}</td>
                          <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{unitInfo?.months}</td>
                          <td className="px-4 py-2.5">
                            <input
                              type="number"
                              value={f.amount}
                              onChange={(e) => updateField(key, 'amount', e.target.value)}
                              placeholder="—"
                              className="input ml-auto w-28 text-right py-1.5"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <input
                              type="number"
                              value={f.second_ward_amount}
                              onChange={(e) => updateField(key, 'second_ward_amount', e.target.value)}
                              placeholder="—"
                              className="input ml-auto w-28 text-right py-1.5"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <input
                              type="number"
                              value={f.fine_amount}
                              onChange={(e) => updateField(key, 'fine_amount', e.target.value)}
                              placeholder="—"
                              className="input ml-auto w-28 text-right py-1.5"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <input
                              type="date"
                              value={f.due_date}
                              onChange={(e) => updateField(key, 'due_date', e.target.value)}
                              className="input w-40 py-1.5"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
