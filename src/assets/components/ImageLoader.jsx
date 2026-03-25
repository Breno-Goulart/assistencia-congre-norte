import React, { useState, useEffect, useRef } from 'react';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../../services/firebase.js';
import { Image as ImageIcon, Camera, Loader2 } from 'lucide-react';

/**
 * Componente ImageLoader
 * Carrega e exibe imagens do Firestore com suporte a cache local e upload (Admin).
 */
export default function ImageLoader({ docPath, fieldName = 'url', alt = 'Banner' }) {
  const cacheKey = `imgCache_${docPath}_${fieldName}`;
  
  // Estados do componente
  const [user, setUser] = useState(null);
  const [imageUrl, setImageUrl] = useState(() => localStorage.getItem(cacheKey) || '');
  const [loading, setLoading] = useState(!imageUrl);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // 1. Monitoramento do Estado de Autenticação
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // 2. Sincronização em Tempo Real (Protegida)
  useEffect(() => {
    if (!docPath) return;

    const docRef = doc(db, docPath);

    // Escuta mudanças no documento para atualizar a imagem automaticamente
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
          console.error("Acesso negado ao Firestore: verifique as regras de segurança.");
        } else {
          console.error("Erro ao carregar imagem em tempo real:", error);
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [docPath, fieldName, cacheKey]);

  // 3. Função de Upload com Validação de Segurança
  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // VALIDAÇÃO: Bloqueia no frontend se não estiver autenticado
    if (!auth.currentUser || !user) {
      console.error("Upload bloqueado: usuário não autenticado.");
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
          
          // Gravação direta no documento do Firestore
          await updateDoc(docRef, { 
            [fieldName]: base64,
            ultimaAtualizacao: new Date().toISOString(),
            atualizadoPor: user.uid
          });
          
          setIsUploading(false);
        } catch (error) {
          console.error("Erro ao salvar no Firestore:", error);
          if (error.code === 'permission-denied') {
            // Em ambiente iframe/canvas, alert() pode não ser visível, 
            // mas mantemos o log para depuração técnica.
            console.error("Permissão de escrita negada para este usuário.");
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
      console.error('Erro crítico no fluxo de processamento:', error);
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
          
          {/* Overlay suave no hover para indicar interatividade */}
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