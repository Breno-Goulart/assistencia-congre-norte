import React, { useState, useEffect, useRef } from 'react';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '../../services/firebase.js';
import { Image as ImageIcon, Camera, Loader2 } from 'lucide-react';

export default function ImageLoader({ docPath, fieldName = 'url', alt = 'Banner' }) {
  const cacheKey = `imgCache_${docPath}_${fieldName}`;
  const [imageUrl, setImageUrl] = useState(() => localStorage.getItem(cacheKey) || '');
  const [loading, setLoading] = useState(!imageUrl);
  const [isUploading, setIsUploading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const fileInputRef = useRef(null);
  const auth = getAuth();

  useEffect(() => {
    // Verificar se o usuário é admin para exibir controles de edição
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setIsAdmin(!!user);
    });

    // Escuta em tempo real no Firestore para atualizações automáticas
    const docRef = doc(db, docPath);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const fetchedUrl = docSnap.data()[fieldName];
        if (fetchedUrl) {
          setImageUrl(fetchedUrl);
          localStorage.setItem(cacheKey, fetchedUrl);
        } else {
          setImageUrl('');
          localStorage.removeItem(cacheKey);
        }
      }
      setLoading(false);
    }, (err) => {
      console.warn('Erro ao carregar imagem em tempo real:', err);
      setLoading(false);
    });

    return () => {
      unsubAuth();
      unsubscribe();
    };
  }, [docPath, fieldName, cacheKey, auth]);

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !isAdmin) return;

    // Validação básica de tamanho (opcional, mas recomendado para Firestore)
    if (file.size > 1024 * 1024) { // 1MB
       // Mantemos a tentativa, mas o Firestore tem limite de 1MB por documento
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target.result;
        const docRef = doc(db, docPath);
        await updateDoc(docRef, { [fieldName]: base64 });
        setIsUploading(false);
      };
      reader.onerror = () => {
        setIsUploading(false);
        console.error("Erro na leitura do arquivo.");
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Erro ao atualizar imagem:', error);
      setIsUploading(false);
    }
  };

  // Estado de Carregamento Inicial
  if (loading && !imageUrl) {
    return (
      <div className="absolute inset-0 w-full h-full bg-gray-100 animate-pulse flex items-center justify-center text-gray-400">
        <Loader2 size={32} className="animate-spin" />
      </div>
    );
  }

  // Fallback caso não exista URL definida
  if (!imageUrl) {
    return (
      <div className="absolute inset-0 w-full h-full bg-gray-100 flex flex-col items-center justify-center text-gray-400 gap-2">
        <ImageIcon size={40} strokeWidth={1.5} />
        <span className="text-sm font-medium">Sem imagem definida</span>
        {isAdmin && (
          <div className="mt-2">
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleImageChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-2"
            >
              {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
              Adicionar Imagem
            </button>
          </div>
        )}
      </div>
    );
  }

  // Renderização da Imagem com controles de Admin
  return (
    <div className="absolute inset-0 w-full h-full group">
      <img
        src={imageUrl}
        alt={alt}
        className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
        fetchPriority="high"
      />
      
      {isAdmin && (
        <>
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageChange}
            className="hidden"
          />
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="absolute top-4 right-4 bg-black/60 hover:bg-black/90 text-white p-3 rounded-full backdrop-blur-md transition-all flex items-center justify-center cursor-pointer pointer-events-auto z-20 shadow-xl border border-white/20 active:scale-90"
            title="Trocar imagem de capa"
          >
            {isUploading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Camera size={20} className="transition-transform group-hover:rotate-12" />
            )}
          </button>
        </>
      )}
    </div>
  );
}