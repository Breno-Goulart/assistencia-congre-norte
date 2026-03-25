import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { PlusCircle, BarChart3, LogOut } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import Login from './pages/Login.jsx';
import { auth } from './services/firebase.js';
import Lancamento from './pages/Lancamento.jsx';
import Dashboard from './pages/Dashboard.jsx';
import logoImg from './assets/logo.png';

// MenuLateral: Gerencia a navegação (Sidebar no Desktop / Barra Inferior no Mobile)
function MenuLateral({ user }) {
  const location = useLocation();
  const isLancamento = location.pathname === '/';

  return (
    <nav className="bg-blue-900 text-white w-full md:w-64 flex md:flex-col justify-between shadow-xl flex-shrink-0 order-last md:order-first z-50 fixed bottom-0 md:relative">
      <div>
        {/* Logo e Identidade com Link Secreto */}
        <div className="p-4 md:p-6 md:border-b border-blue-800 flex items-center justify-center md:justify-start gap-3 relative group">
          <Link to={user ? "/dashboard" : "/login"} title="Acesso Restrito">
            <img src={logoImg} alt="Logo Assistência Norte" className="w-10 h-10 object-contain cursor-pointer" />
          </Link>
          <h1 className="hidden md:block text-xl font-bold">
            Assistência
            <br />
            <span className="text-sm font-normal text-blue-300">Norte</span>
          </h1>
          
          {/* Link Secreto para Login (Invisível) */}
          <Link 
            to="/login" 
            className="absolute top-0 right-0 w-10 h-10 opacity-0 cursor-default"
            aria-hidden="true"
          />
        </div>

        {/* Links de Navegação Primária */}
        <div className="p-4 flex flex-row md:flex-col gap-2 overflow-x-auto justify-center">
          <Link
            to="/"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
              isLancamento ? 'bg-blue-800' : 'hover:bg-blue-800/50 text-blue-300'
            }`}
          >
            <PlusCircle size={20} />
            <span className="font-medium">Lançamento</span>
          </Link>

          {user ? (
            <Link
              to="/dashboard"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                !isLancamento ? 'bg-blue-800' : 'hover:bg-blue-800/50 text-blue-300'
              }`}
            >
              <BarChart3 size={20} />
              <span className="font-medium">Painel (Anciãos)</span>
            </Link>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-3 px-4 py-3 rounded-lg transition text-blue-300/40 hover:text-blue-300/80 hover:bg-blue-800/30"
            >
              <LogOut size={20} className="rotate-180" />
              <span className="font-medium">Acesso Restrito</span>
            </Link>
          )}
        </div>
      </div>

      {/* Seção de Logout (Apenas Desktop) */}
      {user && (
        <div className="hidden md:block p-4 border-t border-blue-800 text-sm">
          <button
            onClick={() =>
              import('firebase/auth')
                .then((m) => m.signOut(auth))
                .catch((err) => console.error('Erro ao sair:', err))
            }
            className="flex items-center gap-2 text-blue-300 hover:text-white transition w-full p-2"
          >
            <LogOut size={16} /> Sair do Sistema
          </button>
        </div>
      )}
    </nav>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Monitoramento do estado de autenticação
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="font-bold text-blue-900 animate-pulse">Carregando Sistema...</span>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans">
        {/* Menu centralizado */}
        <MenuLateral user={user} />
        
        {/* Área de Conteúdo Principal */}
        <main className="flex-1 overflow-y-auto p-4 pb-28 md:p-8 md:pb-8 w-full max-w-6xl mx-auto md:ml-64">
          <div className="mt-2 md:mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Routes>
              {/* Rota Pública de Lançamento */}
              <Route path="/" element={<Lancamento />} />
              
              {/* Rota de Login (Redireciona se já logado) */}
              <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
              
              {/* Rota Protegida do Dashboard */}
              <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" />} />
              
              {/* Fallback para Lançamento */}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}