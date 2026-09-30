import { useState, FormEvent } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CLASSES, SECTIONS, STREAMS, SCIENCE_GROUPS, FEE_CATEGORIES, requiresStream, requiresSubjectGroup } from '@/lib/constants';
import { Student } from '@/lib/types';

interface AddStudentModalProps {
  onClose: () => void;
  onSaved: () => void;
  editingStudent?: Student | null;
}

export default function AddStudentModal({ onClose, onSaved, editingStudent }: AddStudentModalProps) {
  const [form, setForm] = useState({
    admission_number: editingStudent?.admission_number ?? '',
    name: editingStudent?.name ?? '',
    class: editingStudent?.class ?? 'Nursery',
    section: editingStudent?.section ?? 'A',
    stream: editingStudent?.stream ?? '',
    subject_group: editingStudent?.subject_group ?? '',
    fathers_name: editingStudent?.fathers_name ?? '',
    mothers_name: editingStudent?.mothers_name ?? '',
    phone_number: editingStudent?.phone_number ?? '',
    email: editingStudent?.email ?? '',
    fee_category: editingStudent?.fee_category ?? 'CIVILIAN',
    second_ward_discount: editingStudent?.second_ward_discount ?? false,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const needsStream = requiresStream(form.class);
  const needsGroup = requiresSubjectGroup(form.class, form.stream);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.admission_number || !form.name) {
      setError('Admission number and name are required');
      return;
    }
    if (needsStream && !form.stream) {
      setError('Please select a stream for Class 11/12');
      return;
    }
    if (needsGroup && !form.subject_group) {
      setError('Please select a subject group (PCB or PCM) for Science stream');
      return;
    }

    setSaving(true);
    const payload = {
      ...form,
      stream: needsStream ? form.stream : null,
      subject_group: needsGroup ? form.subject_group : null,
    };

    let result;
    if (editingStudent) {
      result = await supabase.from('students').update(payload).eq('id', editingStudent.id);
    } else {
      result = await supabase.from('students').insert(payload);
    }

    setSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {editingStudent ? 'Edit Student' : 'Add New Student'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="h-6 w-6" />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Admission Number *</label>
            <input
              type="text"
              value={form.admission_number}
              onChange={(e) => setForm({ ...form, admission_number: e.target.value })}
              className="input"
              placeholder="e.g. ADM001"
            />
          </div>

          <div>
            <label className="label">Student Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
              placeholder="Full name"
            />
          </div>

          <div>
            <label className="label">Class *</label>
            <select
              value={form.class}
              onChange={(e) => setForm({ ...form, class: e.target.value, stream: '', subject_group: '' })}
              className="input"
            >
              {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Section *</label>
            <select
              value={form.section}
              onChange={(e) => setForm({ ...form, section: e.target.value })}
              className="input"
            >
              {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {needsStream && (
            <div>
              <label className="label">Stream *</label>
              <select
                value={form.stream}
                onChange={(e) => setForm({ ...form, stream: e.target.value, subject_group: '' })}
                className="input"
              >
                <option value="">Select stream</option>
                {STREAMS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {needsGroup && (
            <div>
              <label className="label">Subject Group *</label>
              <select
                value={form.subject_group}
                onChange={(e) => setForm({ ...form, subject_group: e.target.value })}
                className="input"
              >
                <option value="">Select group</option>
                {SCIENCE_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="label">Father's Name</label>
            <input
              type="text"
              value={form.fathers_name}
              onChange={(e) => setForm({ ...form, fathers_name: e.target.value })}
              className="input"
              placeholder="Father's full name"
            />
          </div>

          <div>
            <label className="label">Mother's Name</label>
            <input
              type="text"
              value={form.mothers_name}
              onChange={(e) => setForm({ ...form, mothers_name: e.target.value })}
              className="input"
              placeholder="Mother's full name"
            />
          </div>

          <div>
            <label className="label">Phone Number</label>
            <input
              type="text"
              value={form.phone_number}
              onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
              className="input"
              placeholder="Contact number"
            />
          </div>

          <div>
            <label className="label">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input"
              placeholder="Email address"
            />
          </div>

          <div>
            <label className="label">Fee Category</label>
            <select
              value={form.fee_category}
              onChange={(e) => setForm({ ...form, fee_category: e.target.value })}
              className="input"
            >
              {FEE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="flex items-end">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={form.second_ward_discount}
                onChange={(e) => setForm({ ...form, second_ward_discount: e.target.checked })}
                className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                2nd Ward (second child from same parents — uses 2nd Ward fee)
              </span>
            </label>
          </div>

          <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : editingStudent ? 'Update Student' : 'Add Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
