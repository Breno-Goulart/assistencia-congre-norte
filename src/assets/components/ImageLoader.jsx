import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
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
    // Verificar se o usuário é admin
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setIsAdmin(!!user);
    });

    // Escuta em tempo real para o banner
    const docRef = doc(db, docPath);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const fetchedUrl = docSnap.data()[fieldName];
        if (fetchedUrl) {
          setImageUrl(fetchedUrl);
          localStorage.setItem(cacheKey, fetchedUrl);
        }
      }
      setLoading(false);
    }, (err) => {
      console.warn('Erro ao carregar imagem:', err);
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

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target.result;
        const docRef = doc(db, docPath);
        await updateDoc(docRef, { [fieldName]: base64 });
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Erro ao atualizar imagem:', error);
      setIsUploading(false);
    }
  };

  if (loading && !imageUrl) {
    return (
      <div className="absolute inset-0 w-full h-full bg-gray-200 animate-pulse flex items-center justify-center text-gray-400">
        <ImageIcon size={32} />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 w-full h-full group">
      <img
        src={imageUrl || 'https://via.placeholder.com/800x400?text=Sem+Imagem'}
        alt={alt}
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
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
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="absolute top-4 right-4 bg-black/50 hover:bg-black/80 text-white p-3 rounded-full backdrop-blur-md transition-all flex items-center justify-center cursor-pointer pointer-events-auto z-20 shadow-lg"
            title="Trocar imagem de capa"
          >
            {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
          </button>
        </>
      )}
    </div>
  );
}