// Ficheiro: src/pages/Dashboard.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { FileSpreadsheet, FileText, Trash2, Calendar } from 'lucide-react';

export default function Dashboard() {
  const [assistencias, setAssistencias] = useState([]);
  const [filtroMesAno, setFiltroMesAno] = useState('');
  const relatorioRef = useRef(null);

  useEffect(() => {
    const hoje = new Date();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    setFiltroMesAno(`${hoje.getFullYear()}-${mes}`);

    // Buscar dados em tempo real da base de dados
    const unsubscribe = onSnapshot(collection(db, 'assistencias'), (snapshot) => {
      const records = [];
      snapshot.forEach((doc) => records.push({ id: doc.id, ...doc.data() }));
      records.sort((a, b) => new Date(b.dataReuniao) - new Date(a.dataReuniao));
      setAssistencias(records);
    });

    return () => unsubscribe();
  }, []);

  const dadosFiltrados = useMemo(() => {
    if (!filtroMesAno) return assistencias;
    return assistencias.filter(item => item.dataReuniao.startsWith(filtroMesAno));
  }, [assistencias, filtroMesAno]);

  const handleExcluir = async (id) => {
    if (window.confirm('Tem a certeza que deseja eliminar este registo?')) {
      await deleteDoc(doc(db, 'assistencias', id));
    }
  };

  const exportarExcel = () => {
    const dadosExportacao = dadosFiltrados.map(item => ({
      'Data': item.dataReuniao,
      'Reunião': item.tipoReuniao,
      'Zoom': item.assistenciaZoom,
      'Presencial': item.assistenciaPresencial,
      'Total': item.totalGeral,
      'Entrada': item.indicadorEntrada,
      'Auditório': item.indicadorAuditorio
    }));
    const ws = window.XLSX.utils.json_to_sheet(dadosExportacao);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Assistencias");
    window.XLSX.writeFile(wb, `Relatorio_${filtroMesAno}.xlsx`);
  };

  const exportarPDF = () => {
    const opt = {
      margin: 10,
      filename: `Relatorio_${filtroMesAno}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };
    window.html2pdf().set(opt).from(relatorioRef.current).save();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Painel dos Anciãos</h2>
          <p className="text-gray-500">Gestão e relatórios de assistência.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <input 
            type="month" value={filtroMesAno} onChange={(e) => setFiltroMesAno(e.target.value)}
            className="p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button onClick={exportarExcel} className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex gap-2">
            <FileSpreadsheet size={20} /> Excel
          </button>
          <button onClick={exportarPDF} className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex gap-2">
            <FileText size={20} /> PDF
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden" ref={relatorioRef}>
        <div className="p-4 bg-gray-50 border-b font-bold text-gray-700">Resumo de Assistência</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-100 text-gray-600 text-sm">
                <th className="p-4">Data</th>
                <th className="p-4">Reunião</th>
                <th className="p-4 text-center">Zoom</th>
                <th className="p-4 text-center">Presencial</th>
                <th className="p-4 text-center">Total</th>
                <th className="p-4 html2pdf__exclude">Ações</th>
              </tr>
            </thead>
            <tbody>
              {dadosFiltrados.map((item) => (
                <tr key={item.id} className="border-b hover:bg-gray-50">
                  <td className="p-4 text-sm"><Calendar size={16} className="inline mr-2 text-gray-400"/>{item.dataReuniao}</td>
                  <td className="p-4 text-sm">{item.tipoReuniao}</td>
                  <td className="p-4 text-center text-indigo-600 font-medium">{item.assistenciaZoom}</td>
                  <td className="p-4 text-center text-blue-600 font-medium">{item.assistenciaPresencial}</td>
                  <td className="p-4 text-center font-bold text-emerald-600">{item.totalGeral}</td>
                  <td className="p-4 html2pdf__exclude">
                    <button onClick={() => handleExcluir(item.id)} className="text-red-600 hover:bg-red-100 p-1 rounded">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
