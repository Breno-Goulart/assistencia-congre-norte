import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase.js';
import { Image as ImageIcon } from 'lucide-react';

/**
 * ImageLoader: Componente resiliente para imagens dinâmicas.
 * Exemplo de uso: <ImageLoader docPath="configuracoes/geral" fieldName="logoUrl" />
 */
export default function ImageLoader({ docPath, fieldName = 'imageUrl', alt = 'Imagem' }) {
  // 1. Tenta carregar do localStorage imediatamente (Zero delay se estiver offline e em cache)
  const cacheKey = `imgCache_${docPath}_${fieldName}`;
  const [url, setUrl] = useState(() => localStorage.getItem(cacheKey) || '');
  const [loading, setLoading] = useState(!url);

  useEffect(() => {
    const fetchImage = async () => {
      try {
        const docRef = doc(db, docPath);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const fetchedUrl = docSnap.data()[fieldName];
          // 2. Se a URL do banco for diferente da que está no Cache, atualiza a tela e o cache
          if (fetchedUrl && fetchedUrl !== url) {
            setUrl(fetchedUrl);
            localStorage.setItem(cacheKey, fetchedUrl);
          }
        }
      } catch (error) {
        console.warn('Modo Offline: Usando imagem do cache local.', error);
      } finally {
        setLoading(false);
      }
    };

    fetchImage();
  }, [docPath, fieldName, url, cacheKey]);

  if (loading) {
    return (
      <div className="w-full h-full bg-gray-200 animate-pulse rounded-md flex items-center justify-center text-gray-400">
        <ImageIcon size={24} />
      </div>
    );
  }

  if (!url) {
    return <div className="w-full h-full bg-gray-100 border border-dashed border-gray-300 rounded-md"></div>;
  }

  return <img src={url} alt={alt} className="object-contain w-full h-full" />;
}