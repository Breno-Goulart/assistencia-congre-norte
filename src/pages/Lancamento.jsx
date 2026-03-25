// Arquivo: src/pages/Lancamento.jsx
import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { CheckCircle2 } from 'lucide-react';

export default function Lancamento({ user }) {
  const [formData, setFormData] = useState({
    dataReuniao: new Date().toISOString().split('T')[0],
    tipoReuniao: 'Fim de Semana',
    assistenciaZoom: '',
    assistenciaPresencial: '',
    indicadorEntrada: '',
    indicadorAuditorio: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalGeral = (parseInt(formData.assistenciaZoom) || 0) + (parseInt(formData.assistenciaPresencial) || 0);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return alert("Precisa estar logado!");
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'assistencias'), {
        ...formData,
        assistenciaZoom: parseInt(formData.assistenciaZoom),
        assistenciaPresencial: parseInt(formData.assistenciaPresencial),
        totalGeral,
        dataCriacao: new Date().toISOString(),
        criadoPor: user.uid
      });
      alert('Assistência registrada com sucesso!');
      setFormData(prev => ({ ...prev, assistenciaZoom: '', assistenciaPresencial: '' }));
    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert('Erro ao registrar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Novo Lançamento</h2>
        <p className="text-gray-500 mt-1">Registre a assistência da reunião atual.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Tipo de Reunião</label>
            <select name="tipoReuniao" value={formData.tipoReuniao} onChange={handleChange} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required>
              <option value="Meio de Semana">Meio de Semana</option>
              <option value="Fim de Semana">Fim de Semana</option>
              <option value="Visita">Visita do Superintendente</option>
              <option value="Especial">Assembleia / Congresso</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Data</label>
            <input type="date" name="dataReuniao" value={formData.dataReuniao} onChange={handleChange} className="w-full p-3 border rounded-lg outline-none" required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Zoom</label>
            <input type="number" name="assistenciaZoom" value={formData.assistenciaZoom} onChange={handleChange} className="w-full p-3 border rounded-lg outline-none" required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Presencial</label>
            <input type="number" name="assistenciaPresencial" value={formData.assistenciaPresencial} onChange={handleChange} className="w-full p-3 border rounded-lg outline-none" required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Indicador Entrada</label>
            <input type="text" name="indicadorEntrada" value={formData.indicadorEntrada} onChange={handleChange} className="w-full p-3 border rounded-lg outline-none" required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Indicador Auditório</label>
            <input type="text" name="indicadorAuditorio" value={formData.indicadorAuditorio} onChange={handleChange} className="w-full p-3 border rounded-lg outline-none" required />
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg p-6 flex flex-col items-center mt-6">
          <span className="text-blue-800 text-sm font-semibold uppercase">Total Geral</span>
          <span className="text-5xl font-black text-blue-600">{totalGeral}</span>
        </div>

        <button type="submit" disabled={isSubmitting} className="w-full py-4 rounded-lg font-bold text-white text-lg flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 transition">
          {isSubmitting ? 'Enviando...' : <><CheckCircle2 size={24} /> Confirmar Lançamento</>}
        </button>
      </form>
    </div>
  );
}
