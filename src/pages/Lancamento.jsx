import React, { useState, useEffect } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { CheckCircle2, Loader2 } from 'lucide-react';
import ImageLoader from '../assets/components/ImageLoader';

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

  // cálculo automático do total
  const zoom = parseInt(formData.assistenciaZoom, 10) || 0;
  const presencial = parseInt(formData.assistenciaPresencial, 10) || 0;
  const totalGeral = zoom + presencial;

  const inputBaseClass =
    'w-full p-4 text-xl text-center border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none transition-all';
  const controlClass =
    'w-full p-4 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all shadow-sm';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (zoom < 0 || presencial < 0) {
      setStatus({ type: 'error', message: 'Os valores não podem ser negativos.' });
      return;
    }

    setIsSubmitting(true);
    setStatus({ type: '', message: '' });

    try {
      await addDoc(collection(db, 'assistencias'), {
        ...formData,
        assistenciaZoom: zoom,
        assistenciaPresencial: presencial,
        totalGeral,
        dataCriacao: new Date().toISOString(),
      });

      setStatus({ type: 'success', message: 'Assistência registrada com sucesso!' });
      setFormData((prev) => ({ ...prev, assistenciaZoom: '', assistenciaPresencial: '' }));

      if (window.navigator && window.navigator.vibrate) {
        try {
          window.navigator.vibrate([50, 50, 50]);
        } catch {
          // ignore
        }
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      setStatus({ type: 'error', message: 'Falha ao registrar. Verifique sua conexão.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!status.message) return;
    const timer = setTimeout(() => setStatus({ type: '', message: '' }), 4000);
    return () => clearTimeout(timer);
  }, [status.message]);

  return (
    <div className="w-full max-w-lg mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-8">
      <div className="mb-6">
        <ImageLoader docPath="settings/banner" fieldName="url" alt="Capa" />
        <p className="text-sm text-gray-500 px-1">Preencha os dados de assistência da reunião atual.</p>
      </div>

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Novo Lançamento</h2>
        <p className="text-sm text-gray-500 mt-1">Registre a assistência da reunião.</p>
      </div>

      {status.message && (
        <div
          role="status"
          className={`p-4 mb-6 rounded-lg text-sm font-medium ${
            status.type === 'error'
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}
        >
          {status.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1">
          <label className="text-sm font-semibold text-gray-700">Data</label>
          <input
            type="date"
            name="dataReuniao"
            value={formData.dataReuniao}
            onChange={handleChange}
            className={controlClass}
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold text-gray-700">Tipo de Reunião</label>
          <select
            name="tipoReuniao"
            value={formData.tipoReuniao}
            onChange={handleChange}
            className={controlClass}
            required
          >
            <option value="Meio de Semana">Meio de Semana</option>
            <option value="Fim de Semana">Fim de Semana</option>
            <option value="Visita do Superintendente">Visita do Superintendente</option>
            <option value="Especial">Especial (Assembleia/Congresso)</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-700">Zoom</label>
            <input
              type="number"
              min="0"
              max="1000"
              name="assistenciaZoom"
              value={formData.assistenciaZoom}
              onChange={handleChange}
              placeholder="Ex: 45"
              className={inputBaseClass}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-700">Presencial</label>
            <input
              type="number"
              min="0"
              max="1000"
              name="assistenciaPresencial"
              value={formData.assistenciaPresencial}
              onChange={handleChange}
              placeholder="Ex: 85"
              className={inputBaseClass}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-700">Indicador (Entrada)</label>
            <select
              name="indicadorEntrada"
              value={formData.indicadorEntrada}
              onChange={handleChange}
              className={controlClass}
              required
            >
              <option value="" disabled>Selecione...</option>
              <option value="Irmão A">Irmão A</option>
              <option value="Irmão B">Irmão B</option>
              <option value="Outro">Outro (Substituto)</option>
              <option value="Não Designado">Não Designado</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-700">Indicador (Auditório)</label>
            <select
              name="indicadorAuditorio"
              value={formData.indicadorAuditorio}
              onChange={handleChange}
              className={controlClass}
              required
            >
              <option value="" disabled>Selecione...</option>
              <option value="Irmão C">Irmão C</option>
              <option value="Irmão D">Irmão D</option>
              <option value="Outro">Outro (Substituto)</option>
              <option value="Não Designado">Não Designado</option>
            </select>
          </div>
        </div>

        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-5 flex flex-col items-center justify-center mt-4">
          <span className="text-blue-900 text-xs font-bold uppercase tracking-widest mb-1">Total Geral</span>
          <span className="text-5xl font-black text-blue-600">{totalGeral}</span>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 mt-4 rounded-xl font-bold text-white text-lg flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700