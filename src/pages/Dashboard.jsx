import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, getFirestore, doc, updateDoc } from 'firebase/firestore';
import { FileSpreadsheet, FileText, Calendar, Loader2, Edit2, Save, X } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import ImageLoader from '../assets/components/ImageLoader.jsx';

export default function Dashboard() {
  const [assistencias, setAssistencias] = useState([]);
  const [filtroMesAno, setFiltroMesAno] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [notification, setNotification] = useState({ type: '', message: '' });
  
  // Estados para Edição
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  
  const relatorioRef = useRef(null);

  // Instância do banco de dados
  const db = getFirestore();

  // --- Utilitários ---
  const yieldToBrowser = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 50)));

  const sanitizeFileName = (name) =>
    name
      .replace(/[^a-z0-9_\-\.]/gi, '_')
      .slice(0, 120);

  const formatDateISOToBR = (iso) => {
    if (!iso || typeof iso !== 'string') return '';
    const parts = iso.split('-');
    if (parts.length < 3) return iso;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const showNotification = (type, message, ms = 4000) => {
    setNotification({ type, message });
    if (ms > 0) {
      setTimeout(() => setNotification({ type: '', message: '' }), ms);
    }
  };

  // --- Lógica de Edição ---
  const handleEditClick = (item) => {
    setEditingId(item.id);
    setEditData({ ...item });
  };

  const handleSaveEdit = async () => {
    try {
      const z = Number(editData.assistenciaZoom) || 0;
      const p = Number(editData.assistenciaPresencial) || 0;
      
      const docRef = doc(db, 'assistencias', editingId);
      await updateDoc(docRef, {
        ...editData,
        assistenciaZoom: z,
        assistenciaPresencial: p,
        totalGeral: z + p
      });
      
      setEditingId(null);
      showNotification('success', 'Registro atualizado com sucesso!');
    } catch (err) {
      console.error('Erro ao atualizar:', err);
      showNotification('error', 'Erro ao atualizar o registro.');
    }
  };

  // --- Firestore listener ---
  useEffect(() => {
    const hoje = new Date();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    setFiltroMesAno(`${hoje.getFullYear()}-${mes}`);

    const q = query(collection(db, 'assistencias'), orderBy('dataReuniao', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const records = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setAssistencias(records);
      },
      (error) => {
        console.error('Erro ao escutar Firestore:', error);
        showNotification('error', 'Erro de conexão ou permissão.', 6000);
        setAssistencias([]);
      }
    );

    return () => {
      try { unsubscribe(); } catch { }
    };
  }, [db]);

  const dadosFiltrados = useMemo(() => {
    if (!filtroMesAno) return assistencias;
    return assistencias.filter((item) => {
      const d = item?.dataReuniao;
      if (!d || typeof d !== 'string') return false;
      return d.startsWith(filtroMesAno);
    });
  }, [assistencias, filtroMesAno]);

  // --- Exportar Excel ---
  const exportarExcel = async () => {
    if (!dadosFiltrados || dadosFiltrados.length === 0) {
      showNotification('info', 'Nenhum dado para exportar.', 3000);
      return;
    }

    setIsExporting(true);
    try {
      await yieldToBrowser();
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Assistencias');

      ws.columns = [
        { header: 'Data', key: 'data', width: 14 },
        { header: 'Reunião', key: 'reuniao', width: 30 },
        { header: 'Zoom', key: 'zoom', width: 10 },
        { header: 'Presencial', key: 'presencial', width: 12 },
        { header: 'Total', key: 'total', width: 10 },
        { header: 'Entrada', key: 'entrada', width: 20 },
        { header: 'Auditório', key: 'auditorio', width: 20 },
      ];

      ws.getRow(1).font = { bold: true };
      ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

      dadosFiltrados.forEach((item) => {
        const zoom = Number(item.assistenciaZoom ?? 0);
        const presencial = Number(item.assistenciaPresencial ?? 0);
        ws.addRow({
          data: formatDateISOToBR(item.dataReuniao),
          reuniao: item.tipoReuniao ?? '',
          zoom,
          presencial,
          total: item.totalGeral ?? (zoom + presencial),
          entrada: item.indicadorEntrada ?? '',
          auditorio: item.indicadorAuditorio ?? '',
        });
      });

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const baseName = `Relatorio_Assistencia_${filtroMesAno || 'todos'}`;
      saveAs(blob, `${sanitizeFileName(baseName)}.xlsx`);
      showNotification('success', 'Excel gerado com sucesso.', 3000);
    } catch (error) {
      showNotification('error', 'Erro ao gerar Excel.');
    } finally {
      setIsExporting(false);
    }
  };

  // --- Exportar PDF ---
  const exportarPDF = async () => {
    if (!relatorioRef.current) return;
    setIsExporting(true);
    try {
      await yieldToBrowser();
      const canvas = await html2canvas(relatorioRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${sanitizeFileName(`Relatorio_${filtroMesAno}`)}.pdf`);
      showNotification('success', 'PDF gerado com sucesso.');
    } catch (error) {
      showNotification('error', 'Erro ao gerar PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-6">
      {/* Notificação */}
      <div aria-live="polite" className="fixed top-6 right-6 z-50 pointer-events-none">
        {notification.message && (
          <div className={`pointer-events-auto px-4 py-2 rounded-md shadow-md text-sm font-medium animate-in fade-in slide-in-from-top-2 ${
            notification.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' : 
            notification.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 
            'bg-blue-50 text-blue-700 border border-blue-100'
          }`}>
            {notification.message}
          </div>
        )}
      </div>

      <header className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Relatório de Assistências</h1>
          <p className="text-sm text-gray-500">Gerencie e exporte os registros da congregação.</p>
        </div>

        <div className="w-full sm:w-auto">
          <div className="grid grid-cols-2 md:flex items-center gap-3 w-full md:w-auto">
            <input
              type="month"
              value={filtroMesAno}
              onChange={(e) => setFiltroMesAno(e.target.value)}
              className="col-span-2 md:col-span-1 p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none w-full shadow-sm"
            />
            <button
              onClick={exportarExcel}
              disabled={isExporting}
              className="p-3 bg-emerald-600 disabled:opacity-60 text-white rounded-xl hover:bg-emerald-700 active:scale-95 flex items-center justify-center gap-2 shadow-sm font-medium transition-all"
            >
              {isExporting ? <Loader2 className="animate-spin" size={18} /> : <FileSpreadsheet size={18} />}
              <span>Excel</span>
            </button>
            <button
              onClick={exportarPDF}
              disabled={isExporting}
              className="p-3 bg-red-600 disabled:opacity-60 text-white rounded-xl hover:bg-red-700 active:scale-95 flex items-center justify-center gap-2 shadow-sm font-medium transition-all"
            >
              {isExporting ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
              <span>PDF</span>
            </button>
          </div>
        </div>
      </header>

      <section className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm" ref={relatorioRef}>
        <div className="p-5 bg-gray-50 border-b border-gray-100 font-bold text-gray-800 flex justify-between rounded-t-xl">
          <span>Resumo de Assistência</span>
          <span className="text-gray-500 font-normal">
            {filtroMesAno ? filtroMesAno.split('-').reverse().join('/') : 'Geral'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white text-gray-500 text-[10px] md:text-xs uppercase tracking-wider border-b border-gray-100">
                <th className="p-4 font-semibold">Data / Lançamento</th>
                <th className="p-4 font-semibold">Reunião / Indicadores</th>
                <th className="p-4 font-semibold text-center">Zoom</th>
                <th className="p-4 font-semibold text-center">Presencial</th>
                <th className="p-4 font-bold text-center text-blue-900 bg-blue-50/30">Total</th>
                <th className="p-4 font-semibold text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {dadosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-gray-400">
                    Nenhum registro encontrado para este período.
                  </td>
                </tr>
              ) : (
                dadosFiltrados.map((item) => (
                  <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    {editingId === item.id ? (
                      <td colSpan="6" className="p-4">
                        <div className="flex flex-col gap-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100 animate-in fade-in zoom-in-95 duration-200">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2">
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-blue-900 px-1">DATA</label>
                              <input type="date" value={editData.dataReuniao} onChange={(e)=>setEditData({...editData, dataReuniao: e.target.value})} className="p-2 border rounded-lg text-sm" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-blue-900 px-1">TIPO REUNIÃO</label>
                              <select value={editData.tipoReuniao} onChange={(e)=>setEditData({...editData, tipoReuniao: e.target.value})} className="p-2 border rounded-lg text-sm">
                                <option value="Meio de Semana">Meio de Semana</option>
                                <option value="Fim de Semana">Fim de Semana</option>
                                <option value="Visita do Superintendente">Visita do Superintendente</option>
                                <option value="Comemoração da morte de Jesus">Comemoração da morte de Jesus</option>
                                <option value="Reunião especial com Betel">Reunião especial com Betel</option>
                              </select>
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-blue-900 px-1">ZOOM</label>
                              <input type="number" value={editData.assistenciaZoom} onChange={(e)=>setEditData({...editData, assistenciaZoom: e.target.value})} className="p-2 border rounded-lg text-sm" placeholder="Zoom" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-blue-900 px-1">PRESENCIAL</label>
                              <input type="number" value={editData.assistenciaPresencial} onChange={(e)=>setEditData({...editData, assistenciaPresencial: e.target.value})} className="p-2 border rounded-lg text-sm" placeholder="Presencial" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-blue-900 px-1">INDICADOR ENT.</label>
                              <input type="text" value={editData.indicadorEntrada} onChange={(e)=>setEditData({...editData, indicadorEntrada: e.target.value.toUpperCase()})} className="p-2 border rounded-lg text-sm" placeholder="Entrada" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-blue-900 px-1">INDICADOR AUD.</label>
                              <input type="text" value={editData.indicadorAuditorio} onChange={(e)=>setEditData({...editData, indicadorAuditorio: e.target.value.toUpperCase()})} className="p-2 border rounded-lg text-sm" placeholder="Auditório" />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 mt-2">
                            <button onClick={()=>setEditingId(null)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-lg flex items-center gap-1 transition-all"><X size={16}/> Cancelar</button>
                            <button onClick={handleSaveEdit} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg flex items-center gap-1 transition-all shadow-sm"><Save size={16}/> Salvar</button>
                          </div>
                        </div>
                      </td>
                    ) : (
                      <>
                        <td className="p-4 text-gray-800 font-medium text-sm">
                          <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-gray-400" />
                            {formatDateISOToBR(item.dataReuniao)}
                          </div>
                          {item.dataCriacao && (
                            <div className="text-[10px] text-gray-400 mt-1 italic">
                              Enviado: {new Date(item.dataCriacao).toLocaleString('pt-BR')}
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-gray-600 text-sm">
                          <div className="font-semibold text-gray-800">{item.tipoReuniao ?? ''}</div>
                          <div className="text-[10px] md:text-xs text-gray-500 mt-1">
                            <span className="font-medium text-blue-700">E:</span> {item.indicadorEntrada || '-'} | <span className="font-medium text-blue-700">A:</span> {item.indicadorAuditorio || '-'}
                          </div>
                        </td>
                        <td className="p-4 text-center font-medium text-indigo-600">{item.assistenciaZoom ?? 0}</td>
                        <td className="p-4 text-center font-medium text-blue-600">{item.assistenciaPresencial ?? 0}</td>
                        <td className="p-4 text-center font-black text-emerald-600 bg-blue-50/30">
                          {item.totalGeral ?? (Number(item.assistenciaZoom || 0) + Number(item.assistenciaPresencial || 0))}
                        </td>
                        <td className="p-4 text-center">
                          <button 
                            onClick={() => handleEditClick(item)} 
                            className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 hover:text-blue-700 transition-all shadow-sm"
                            title="Editar Registro"
                          >
                            <Edit2 size={16} />
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-8">
        <ImageLoader docPath="settings/banner" fieldName="url" alt="Banner Rodapé" />
      </div>
    </div>
  );
}