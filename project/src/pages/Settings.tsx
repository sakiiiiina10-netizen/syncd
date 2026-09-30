import { User, Moon, Sun, Save, Check, LogOut } from 'lucide-react';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { SCHOOL_NAME } from '@/lib/constants';

export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <Layout>
      <PageHeader title="Settings" subtitle="Manage your account and app preferences" />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Theme Settings */}
        <div className="card p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Appearance</h3>
          <div className="flex items-center justify-between rounded-xl border border-gray-200 p-4 dark:border-gray-800">
            <div className="flex items-center gap-3">
              {theme === 'light' ? <Sun className="h-5 w-5 text-orange-500" /> : <Moon className="h-5 w-5 text-blue-400" />}
              <div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {theme === 'light' ? 'Light Mode' : 'Dark Mode'}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Toggle between light and dark themes
                </div>
              </div>
            </div>
            <button
              onClick={toggleTheme}
              className={`relative h-7 w-12 rounded-full transition-colors ${theme === 'dark' ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        {/* Account Settings */}
        <div className="card p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Account Settings</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950">
                <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="font-medium text-gray-900 dark:text-white">Profile</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</div>
              </div>
            </div>

            {saved && (
              <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
                <Check className="h-4 w-4" />
                Settings saved successfully!
              </div>
            )}

            <button onClick={handleSave} className="btn-primary w-full">
              <Save className="h-4 w-4" />
              Save Settings
            </button>
          </div>
        </div>

        {/* About */}
        <div className="card p-6 lg:col-span-2">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">About {SCHOOL_NAME}</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
              <div className="text-xs text-gray-500">Application</div>
              <div className="mt-1 font-medium text-gray-900 dark:text-white">{SCHOOL_NAME}</div>
            </div>
            <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
              <div className="text-xs text-gray-500">Type</div>
              <div className="mt-1 font-medium text-gray-900 dark:text-white">School Management System</div>
            </div>
            <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
              <div className="text-xs text-gray-500">Classes</div>
              <div className="mt-1 font-medium text-gray-900 dark:text-white">Nursery to Class 12</div>
            </div>
          </div>

          <div className="mt-6 border-t border-gray-200 pt-6 dark:border-gray-800">
            <button onClick={handleSignOut} className="btn-danger">
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
