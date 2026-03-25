// components/ImageLoaderAdmin.js
import React, { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged } from 'firebase/auth';
import { db, storage, auth } from '../services/firebase';
import { Camera, Loader2 } from 'lucide-react';

export default function ImageLoaderAdmin() {
  const [imageUrl, setImageUrl] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => setIsAdmin(!!user));
    const unsubDoc = onSnapshot(doc(db, 'settings', 'banner'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().url) {
        setImageUrl(docSnap.data().url);
      }
    });
    return () => {
      unsubAuth();
      unsubDoc();
    };
  }, []);

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const storageRef = ref(storage, `banners/capa_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await setDoc(doc(db, 'settings', 'banner'), { url });
    } catch {
      alert('Erro ao fazer upload.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="relative w-full h-40 sm:h-52 rounded-2xl overflow-hidden shadow-sm bg-gray-200 group">
      {imageUrl && (
        <img
          src={imageUrl}
          alt="Capa"
          className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
        />
      )}
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
            className="absolute top-3 right-3 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full backdrop-blur-sm transition-all flex items-center justify-center pointer-events-auto"
          >
            {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
          </button>
        </>
      )}
    </div>
  );
}