import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { CheckCircle2, Loader2 } from 'lucide-react';

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

  // Cálculo automático do Total Geral
  const zoom = parseInt(formData.assistenciaZoom) || 0;
  const presencial = parseInt(formData.assistenciaPresencial) || 0;
  const totalGeral = zoom + presencial;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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
      // Limpa os números, mas mantém a data e os nomes para facilitar novos lançamentos
      setFormData(prev => ({ ...prev, assistenciaZoom: '', assistenciaPresencial: '' }));
      
      setTimeout(() => setStatus({ type: '', message: '' }), 4000);
    } catch (error) {
      console.error("Erro ao salvar:", error);
      setStatus({ type: 'error', message: 'Falha ao registrar. Verifique sua conexão.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Novo Lançamento</h2>
        <p className="text-sm text-gray-500 mt-1">Registre a assistência da reunião.</p>
      </div>

      {status.message && (
        <div className={`p-4 mb-6 rounded-lg text-sm font-medium ${status.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
          {status.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1">
          <label className="text-sm font-semibold text-gray-700">Data</label>
          <input type="date" name="dataReuniao" value={formData.dataReuniao} onChange={handleChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition-all" required />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold text-gray-700">Tipo de Reunião</label>
          <select name="tipoReuniao" value={formData.tipoReuniao} onChange={handleChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition-all" required>
            <option value="Meio de Semana">Meio de Semana</option>
            <option value="Fim de Semana">Fim de Semana</option>
            <option value="Visita do Superintendente">Visita do Superintendente</option>
            <option value="Especial">Especial (Assembleia/Congresso)</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-700">Zoom</label>
            <input type="number" min="0" max="1000" name="assistenciaZoom" value={formData.assistenciaZoom} onChange={handleChange} placeholder="Ex: 45" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition-all" required />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-700">Presencial</label>
            <input type="number" min="0" max="1000" name="assistenciaPresencial" value={formData.assistenciaPresencial} onChange={handleChange} placeholder="Ex: 85" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition-all" required />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-700">Indicador (Entrada)</label>
            <select name="indicadorEntrada" value={formData.indicadorEntrada} onChange={handleChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none bg-white" required>
              <option value="" disabled>Selecione...</option>
              <option value="Irmão A">Irmão A</option>
              <option value="Irmão B">Irmão B</option>
              <option value="Outro">Outro (Substituto)</option>
              <option value="Não Designado">Não Designado</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-700">Indicador (Auditório)</label>
            <select name="indicadorAuditorio" value={formData.indicadorAuditorio} onChange={handleChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none bg-white" required>
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
          className="w-full py-4 mt-2 rounded-xl font-bold text-white text-lg flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <Loader2 className="animate-spin" size={24} />
          ) : (
            <span className="flex items-center gap-2">
              <CheckCircle2 size={24} /> 
              {/* CORREÇÃO: Texto envolvido em span previne o erro removeChild causado por tradutores */}
              <span>Registrar Assistência</span>
            </span>
          )}
        </button>
      </form>
    </div>
  );
}