import React, { useState, useEffect, useRef } from 'react';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../../services/firebase.js';
import { Image as ImageIcon, Camera, Loader2 } from 'lucide-react';

export default function ImageLoader({ docPath, fieldName = 'url', alt = 'Banner' }) {
  const cacheKey = `imgCache_${docPath}_${fieldName}`;
  
  // Estados do componente
  const [user, setUser] = useState(null);
  const [imageUrl, setImageUrl] = useState(() => localStorage.getItem(cacheKey) || '');
  const [loading, setLoading] = useState(!imageUrl);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // 1. Garantir Estado de Autenticação
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // 2. Corrigir e Proteger o onSnapshot
  useEffect(() => {
    // Definimos a referência fora para uso consistente
    const docRef = doc(db, docPath);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const fetchedUrl = snapshot.data()[fieldName];
          if (fetchedUrl) {
            setImageUrl(fetchedUrl);
            localStorage.setItem(cacheKey, fetchedUrl);
          } else {
            setImageUrl('');
            localStorage.removeItem(cacheKey);
          }
        }
        setLoading(false);
      },
      (error) => {
        if (error.code === 'permission-denied') {
          console.error("Acesso negado: sem permissão para ler a imagem.");
        } else {
          console.error("Erro ao carregar imagem:", error);
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [docPath, fieldName, cacheKey]);

  // 3. Proteger a Função de Upload / updateDoc
  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    
    if (!user) {
      console.error("Upload bloqueado: usuário não autenticado.");
      return;
    }

    if (!file) return;

    // Limite de 1MB para documentos Firestore
    if (file.size > 1048487) {
      console.warn("Arquivo muito grande. O limite do Firestore é de aproximadamente 1MB.");
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          const base64 = event.target.result;
          const docRef = doc(db, docPath);
          
          await updateDoc(docRef, { 
            [fieldName]: base64,
            ultimaAtualizacao: new Date().toISOString()
          });
          
          setIsUploading(false);
        } catch (error) {
          if (error.code === 'permission-denied') {
            console.error("Acesso negado: você não tem permissão de escrita.");
          } else {
            console.error("Erro ao atualizar Firestore:", error);
          }
          setIsUploading(false);
        }
      };

      reader.onerror = (err) => {
        console.error("Erro na leitura do arquivo:", err);
        setIsUploading(false);
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Erro no processamento da imagem:', error);
      setIsUploading(false);
    }
  };

  // Renderização: Estado de Carregamento
  if (loading && !imageUrl) {
    return (
      <div className="absolute inset-0 w-full h-full bg-gray-100 animate-pulse flex items-center justify-center text-gray-400">
        <Loader2 size={32} className="animate-spin" />
      </div>
    );
  }

  // Renderização Principal
  return (
    <div className="absolute inset-0 w-full h-full group overflow-hidden">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={alt}
          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
          fetchPriority="high"
        />
      ) : (
        <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center text-gray-400 gap-2">
          <ImageIcon size={40} strokeWidth={1.5} />
          <span className="text-sm font-medium">Sem imagem definida</span>
        </div>
      )}

      {/* 4. Corrigir Exibição do Input de Upload (JSX) */}
      {user && (
        <div className="upload-section">
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageChange}
            className="hidden"
          />
          
          {/* Overlay Escuro no Hover */}
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
        </div>
      )}
    </div>
  );
}