import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../services/firebase.js';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const controlClass =
    'w-full p-4 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all shadow-sm';

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/dashboard');
    } catch (err) {
      setError('Credenciais inválidas ou sem permissão.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto mt-10 bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
      <div className="flex flex-col items-center mb-8">
        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3">
          <Lock size={24} />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">Acesso Restrito</h2>
        <p className="text-sm text-gray-500 text-center mt-1">Apenas anciãos designados.</p>
      </div>

      {error && (
        <div className="p-3 mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-5">
        <div className="space-y-1">
          <label className="text-sm font-semibold text-gray-700">E-mail</label>
          <input
            type="email"
            value={email}
            autoComplete="username"
            inputMode="email"
            onChange={(e) => setEmail(e.target.value)}
            className={controlClass}
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-semibold text-gray-700">Senha</label>
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            className={controlClass}
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 mt-2 rounded-xl font-bold text-white text-lg flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            'Entrar no Painel'
          )}
        </button>
      </form>
    </div>
  );
}