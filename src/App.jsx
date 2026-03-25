import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { PlusCircle, BarChart3, LogOut } from 'lucide-react';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { auth } from './services/firebase';
import Lancamento from './pages/Lancamento';
import Dashboard from './pages/Dashboard';
import logoImg from './assets/logo.png';

// Componente para detetar a rota ativa e pintar o menu
function MenuLateral() {
  const location = useLocation();
  const isLancamento = location.pathname === '/';
  
  return (
    <nav className="bg-blue-900 text-white w-full md:w-64 flex flex-col justify-between shadow-xl flex-shrink-0">
      <div>
        <div className="p-6 border-b border-blue-800 flex items-center gap-3">
          <img src={logoImg} alt="Logo Assistência Norte" className="w-10 h-10 object-contain" />
          <h1 className="text-xl font-bold">Assistência<br/><span className="text-sm font-normal text-blue-300">Norte</span></h1>
        </div>
        <div className="p-4 flex flex-col gap-2">
          <Link to="/" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${isLancamento ? 'bg-blue-800' : 'hover:bg-blue-800/50'}`}>
            <PlusCircle size={20} /> Lançamento
          </Link>
          <Link to="/dashboard" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${!isLancamento ? 'bg-blue-800' : 'hover:bg-blue-800/50'}`}>
            <BarChart3 size={20} /> Painel (Anciãos)
          </Link>
        </div>
      </div>
      <div className="p-4 border-t border-blue-800 text-sm">
          <button className="flex items-center gap-2 text-blue-300 hover:text-white transition w-full">
          <LogOut size={16} /> Sair do Sistema
        </button>
      </div>
    </nav>
  );
}

// ... (mantenha os imports e os outros componentes como MenuLateral iguais)

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // CORREÇÃO: Tratamento de erro adicionado para não quebrar a UI
    signInAnonymously(auth).catch((error) => {
      console.warn('Aviso: Login anônimo falhou. Verifique o Firebase Console.', error.message);
    });

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  if (loading) return <div className="flex h-screen items-center justify-center font-bold text-gray-500 animate-pulse">A carregar Sistema...</div>;

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans">
        <MenuLateral />
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Routes>
            <Route path="/" element={<Lancamento user={user} />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}