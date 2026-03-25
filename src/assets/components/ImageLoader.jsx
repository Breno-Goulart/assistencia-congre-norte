import React, { useState, useEffect, useRef } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../../services/firebase.js';
import { Image as ImageIcon, Camera, Loader2 } from 'lucide-react';

/**
 * Componente ImageLoader
 * Carrega e exibe imagens do Firestore com suporte a cache local e upload (Admin).
 * Utiliza setDoc com merge para garantir a criação do documento caso não exista.
 */
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
    if (!docPath) return;

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

  // 3. Proteger a Função de Upload / setDoc (Merge)
  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Bloqueia no frontend antes de bater no Firebase
    if (!auth.currentUser || !user) {
      console.error("Upload bloqueado: usuário não autenticado no Firebase.");
      return; 
    }

    // Alerta sobre o limite de tamanho do Firestore (aprox. 1MB por documento)
    if (file.size > 1000000) {
      console.warn("Aviso: O arquivo excede 1MB. O Firestore pode rejeitar a gravação.");
    }

    setIsUploading(true);

    try {
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          const base64 = event.target.result;
          const docRef = doc(db, docPath);
          
          // Gravação no documento do Firestore criando-o se não existir (merge: true)
          await setDoc(docRef, { 
            [fieldName]: base64,
            ultimaAtualizacao: new Date().toISOString(),
            atualizadoPor: user.uid
          }, { merge: true });
          
          setIsUploading(false);
        } catch (error) {
          console.error("Erro no fluxo de salvamento:", error);
          if (error.code === 'permission-denied') {
            console.error("Acesso negado: você não tem permissão de escrita.");
          }
          setIsUploading(false);
        }
      };

      reader.onerror = (err) => {
        console.error("Erro na leitura do arquivo local:", err);
        setIsUploading(false);
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Erro crítico no processamento:', error);
      setIsUploading(false);
    }
  };

  // Renderização: Estado de Carregamento Inicial
  if (loading && !imageUrl) {
    return (
      <div className="absolute inset-0 w-full h-full bg-gray-100 animate-pulse flex items-center justify-center text-gray-400">
        <Loader2 size={32} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 w-full h-full group overflow-hidden">
      {/* Exibição da Imagem ou Placeholder */}
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
          <span className="text-sm font-medium italic">Sem imagem definida</span>
        </div>
      )}

      {/* 4. Controles de Administração (Apenas se logado) */}
      {user && (
        <div className="absolute inset-0 z-20">
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageChange}
            className="hidden"
          />
          
          {/* Overlay suave no hover */}
          <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="absolute top-4 right-4 bg-black/60 hover:bg-black/90 text-white p-3 rounded-full backdrop-blur-md transition-all flex items-center justify-center cursor-pointer shadow-xl border border-white/10 active:scale-95 disabled:opacity-50"
            title="Trocar imagem de capa"
          >
            {isUploading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Camera size={20} className="transition-transform group-hover:rotate-6" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}