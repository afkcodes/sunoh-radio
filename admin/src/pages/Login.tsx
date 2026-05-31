import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../auth';
import { Button, Input, Logo } from '../components/ui';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(password);
      navigate('/');
    } catch {
      setError('Incorrect password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid h-full place-items-center bg-ink-950 bg-grid p-6 text-ink-100">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-8 flex justify-center">
          <Logo size={34} />
        </div>
        <form onSubmit={submit} className="card border-ink-800 bg-ink-900 p-6">
          <h1 className="text-lg font-bold">Sign in</h1>
          <p className="mt-1 text-sm text-ink-400">Enter the admin password to manage the catalog.</p>
          <div className="relative mt-5">
            <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
            <Input
              type="password"
              autoFocus
              placeholder="Admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-9"
            />
          </div>
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          <Button type="submit" loading={loading} className="mt-4 w-full">
            Sign in
          </Button>
        </form>
        <p className="mt-4 text-center font-mono text-[11px] text-ink-600">sunoh-radio · admin console</p>
      </div>
    </div>
  );
}
