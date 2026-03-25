import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase.js';
import { CheckCircle2, Loader2 } from 'lucide-react';
import ImageLoader from '../assets/components/ImageLoader.jsx';

export default function Lancamento() {
  const [formData, setFormData] = useState({
    dataReuniao: new Date().toISOString().split('T')[0],
    tipoReuniao: 'Fim de Semana',
    indicadorEntrada: '',
    indicadorAuditorio: '',
    assistenciaZoom: '',
    assistenciaPresencial: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [showConfirm, setShowConfirm] = useState(false);

  const zoom = Number(formData.assistenciaZoom) || 0;
  const presencial = Number(formData.assistenciaPresencial) || 0;

  const totalGeral = useMemo(() => zoom + presencial, [zoom, presencial]);

  const inputBaseClass =
    'w-full p-4 text-xl text-center border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none transition-all appearance-none bg-white';
  const controlClass =
    'w-full p-4 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all shadow-sm';

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    const finalValue = name.includes('indicador') ? value.toUpperCase() : value;
    setFormData((prev) => ({ ...prev, [name]: finalValue }));
  }, []);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    setShowConfirm(true);
  }, []);

  const confirmSubmit = useCallback(async () => {
    setShowConfirm(false);

    const z = Math.max(0, Number(formData.assistenciaZoom) || 0);
    const p = Math.max(0, Number(formData.assistenciaPresencial) || 0);

    if (!Number.isFinite(z) || !Number.isFinite(p)) {
      setStatus({ type: 'error', message: 'Valores inválidos.' });
      return;
    }

    setIsSubmitting(true);
    setStatus({ type: '', message: '' });

    try {
      await addDoc(collection(db, 'assistencias'), {
        ...formData,
        assistenciaZoom: z,
        assistenciaPresencial: p,
        totalGeral: z + p,
        dataCriacao: new Date().toISOString()
      });

      setStatus({ type: 'success', message: 'Assistência registrada com sucesso!' });
      setFormData((prev) => ({
        ...prev,
        assistenciaZoom: '',
        assistenciaPresencial: '',
        indicadorEntrada: '',
        indicadorAuditorio: ''
      }));
      
      window.scrollTo({ top: 0, behavior: 'smooth' });

      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        try {
          window.navigator.vibrate([50, 50, 50]);
        } catch (err) {
          // ignore
        }
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      setStatus({ type: 'error', message: 'Falha ao registrar. Verifique sua conexão.' });
    } finally {
      setIsSubmitting(false);
    }
  }, [formData]);

  useEffect(() => {
    if (!status.message) return;
    const timer = setTimeout(() => setStatus({ type: '', message: '' }), 4000);
    return () => clearTimeout(timer);
  }, [status.message]);

  return (
    <div className="w-full max-w-lg mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-8">
      <div className="mb-6">
        <ImageLoader docPath="settings/banner" fieldName="url" alt="Capa" />
        <p className="text-sm text-gray-500 px-1 mt-2">Preencha os dados de assistência da reunião atual.</p>
      </div>

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Novo Lançamento</h2>
        <p className="text-sm text-gray-500 mt-1">Registre a assistência da reunião.</p>
      </div>

      {status.message && (
        <div
          role="status"
          aria-live="polite"
          className={`p-4 mb-6 rounded-lg text-sm font-medium ${
            status.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
          }`}
        >
          {status.message}
        </div>
      )}

      {/* Modal de Confirmação */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold mb-4 text-gray-800">Confirmar Dados</h3>
            <ul className="text-sm space-y-3 text-gray-600 mb-6">
              <li className="flex justify-between border-b border-gray-100 pb-1"><span>Data:</span> <span className="font-semibold text-gray-900">{formData.dataReuniao.split('-').reverse().join('/')}</span></li>
              <li className="flex justify-between border-b border-gray-100 pb-1"><span>Reunião:</span> <span className="font-semibold text-gray-900">{formData.tipoReuniao}</span></li>
              <li className="flex justify-between border-b border-gray-100 pb-1"><span>Zoom:</span> <span className="font-semibold text-gray-900">{formData.assistenciaZoom}</span></li>
              <li className="flex justify-between border-b border-gray-100 pb-1"><span>Presencial:</span> <span className="font-semibold text-gray-900">{formData.assistenciaPresencial}</span></li>
              <li className="flex justify-between border-b border-gray-100 pb-1"><span>Entrada:</span> <span className="font-semibold text-gray-900">{formData.indicadorEntrada}</span></li>
              <li className="flex justify-between border-b border-gray-100 pb-1"><span>Auditório:</span> <span className="font-semibold text-gray-900">{formData.indicadorAuditorio}</span></li>
              <li className="pt-2 flex justify-between items-center text-blue-600">
                <strong className="text-lg">Total:</strong> 
                <strong className="text-2xl">{totalGeral}</strong>
              </li>
            </ul>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowConfirm(false)} 
                type="button" 
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all active:scale-95"
              >
                Editar
              </button>
              <button 
                onClick={confirmSubmit} 
                type="button" 
                className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all active:scale-95"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1">
          <label htmlFor="dataReuniao" className="text-sm font-semibold text-gray-700">Data</label>
          <input
            id="dataReuniao"
            type="date"
            name="dataReuniao"
            value={formData.dataReuniao}
            onChange={handleChange}
            className={controlClass}
            required
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="tipoReuniao" className="text-sm font-semibold text-gray-700">Tipo de Reunião</label>
          <select
            id="tipoReuniao"
            name="tipoReuniao"
            value={formData.tipoReuniao}
            onChange={handleChange}
            className={controlClass}
            required
          >
            <option value="Meio de Semana">Meio de Semana</option>
            <option value="Fim de Semana">Fim de Semana</option>
            <option value="Visita do Superintendente">Visita do Superintendente</option>
            <option value="Comemoração da morte de Jesus">Comemoração da morte de Jesus</option>
            <option value="Reunião especial com Betel">Reunião especial com Betel</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="assistenciaZoom" className="text-sm font-semibold text-gray-700">Zoom</label>
            <select
              id="assistenciaZoom"
              name="assistenciaZoom"
              value={formData.assistenciaZoom}
              onChange={handleChange}
              className={inputBaseClass}
              required
            >
              <option value="" disabled>Selecione...</option>
              {Array.from({ length: 1001 }, (_, i) => (
                <option key={`z-${i}`} value={i}>{i}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="assistenciaPresencial" className="text-sm font-semibold text-gray-700">Presencial</label>
            <select
              id="assistenciaPresencial"
              name="assistenciaPresencial"
              value={formData.assistenciaPresencial}
              onChange={handleChange}
              className={inputBaseClass}
              required
            >
              <option value="" disabled>Selecione...</option>
              {Array.from({ length: 1001 }, (_, i) => (
                <option key={`p-${i}`} value={i}>{i}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="indicadorEntrada" className="text-sm font-semibold text-gray-700">Indicador (Entrada)</label>
            <input
              id="indicadorEntrada"
              type="text"
              name="indicadorEntrada"
              value={formData.indicadorEntrada}
              onChange={handleChange}
              placeholder="Digite o nome..."
              className={controlClass}
              required
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="indicadorAuditorio" className="text-sm font-semibold text-gray-700">Indicador (Auditório)</label>
            <input
              id="indicadorAuditorio"
              type="text"
              name="indicadorAuditorio"
              value={formData.indicadorAuditorio}
              onChange={handleChange}
              placeholder="Digite o nome..."
              className={controlClass}
              required
            />
          </div>
        </div>

        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-5 flex flex-col items-center justify-center mt-4">
          <span className="text-blue-900 text-xs font-bold uppercase tracking-widest mb-1">Total Geral</span>
          <span className="text-5xl font-black text-blue-600">{totalGeral}</span>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 mt-4 rounded-xl font-bold text-white text-lg flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 active:scale-[0.98] transition-all shadow-lg hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          {isSubmitting ? (
            <Loader2 className="animate-spin" size={24} />
          ) : (
            <span className="flex items-center gap-2">
              <CheckCircle2 size={24} />
              <span>Registrar Assistência</span>
            </span>
          )}
        </button>
      </form>
    </div>
  );
}