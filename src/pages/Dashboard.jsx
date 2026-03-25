import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, getFirestore } from 'firebase/firestore';
import { FileSpreadsheet, FileText, Calendar } from 'lucide-react';

export default function Dashboard() {
  const [assistencias, setAssistencias] = useState([]);
  const [filtroMesAno, setFiltroMesAno] = useState('');
  const relatorioRef = useRef(null);
  
  // Obtém a instância do banco de dados automaticamente do Firebase App inicializado
  const db = getFirestore();

  useEffect(() => {
    const hoje = new Date();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    setFiltroMesAno(`${hoje.getFullYear()}-${mes}`);

    const q = query(collection(db, 'assistencias'), orderBy('dataReuniao', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAssistencias(records);
    });

    return () => unsubscribe();
  }, [db]);

  const dadosFiltrados = useMemo(() => {
    if (!filtroMesAno) return assistencias;
    return assistencias.filter(item => item.dataReuniao.startsWith(filtroMesAno));
  }, [assistencias, filtroMesAno]);

  const exportarExcel = async () => {
    try {
      // Importação dinâmica para evitar erros de resolução no ambiente de preview
      const libName = 'xlsx';
      const XLSX = await import(/* @vite-ignore */ libName);
      
      const dadosExportacao = dadosFiltrados.map(item => ({
        'Data': item.dataReuniao.split('-').reverse().join('/'),
        'Reunião': item.tipoReuniao,
        'Zoom': item.assistenciaZoom,
        'Presencial': item.assistenciaPresencial,
        'Total': item.totalGeral,
        'Entrada': item.indicadorEntrada,
        'Auditório': item.indicadorAuditorio
      }));
      
      const ws = XLSX.utils.json_to_sheet(dadosExportacao);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Assistencias");
      XLSX.writeFile(wb, `Relatorio_Assistencia_${filtroMesAno}.xlsx`);
    } catch (error) {
      console.error("Erro ao gerar Excel:", error);
      alert("Não foi possível gerar o Excel. Verifique se a biblioteca está instalada.");
    }
  };

  const exportarPDF = async () => {
    try {
      // Importação dinâmica para evitar erros de resolução no ambiente de preview
      const libName = 'html2pdf.js';
      const html2pdfModule = await import(/* @vite-ignore */ libName);
      const html2pdf = html2pdfModule.default || html2pdfModule;
      
      const element = relatorioRef.current;
      const opt = {
        margin: 10,
        filename: `Relatorio_Assistencia_${filtroMesAno}.pdf`,
        image: { type: 'jpeg', quality: 1.0 }, // Alta qualidade
        html2canvas: { scale: 3, useCORS: true }, // Escala 3 para alta resolução
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
      };
      
      html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert("Não foi possível gerar o PDF. Verifique se a biblioteca está instalada.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Painel de Relatórios</h2>
          <p className="text-gray-500">Acompanhamento de assistências.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <input 
            type="month" value={filtroMesAno} onChange={(e) => setFiltroMesAno(e.target.value)}
            className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none w-full md:w-auto"
          />
          <button onClick={exportarExcel} className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 shadow-sm font-medium transition-colors">
            <FileSpreadsheet size={18} /> Excel
          </button>
          <button onClick={exportarPDF} className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 shadow-sm font-medium transition-colors">
            <FileText size={18} /> PDF
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden" ref={relatorioRef}>
        <div className="p-5 bg-gray-50 border-b border-gray-100 font-bold text-gray-800 flex justify-between">
          <span>Resumo de Assistência</span>
          <span className="text-gray-500 font-normal">{filtroMesAno.split('-').reverse().join('/')}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                <th className="p-4 font-semibold">Data</th>
                <th className="p-4 font-semibold">Reunião</th>
                <th className="p-4 font-semibold text-center">Zoom</th>
                <th className="p-4 font-semibold text-center">Presencial</th>
                <th className="p-4 font-bold text-center text-blue-900 bg-blue-50/30">Total</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {dadosFiltrados.length === 0 ? (
                <tr><td colSpan="5" className="p-8 text-center text-gray-400">Nenhum dado encontrado para este mês.</td></tr>
              ) : (
                dadosFiltrados.map((item) => (
                  <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="p-4 text-gray-800 font-medium">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-gray-400"/>
                        {item.dataReuniao.split('-').reverse().join('/')}
                      </div>
                    </td>
                    <td className="p-4 text-gray-600">{item.tipoReuniao}</td>
                    <td className="p-4 text-center font-medium text-indigo-600">{item.assistenciaZoom}</td>
                    <td className="p-4 text-center font-medium text-blue-600">{item.assistenciaPresencial}</td>
                    <td className="p-4 text-center font-black text-emerald-600 bg-blue-50/30">{item.totalGeral}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}