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
    if (!editingId) return;

    try {
      const z = Number(editData.assistenciaZoom) || 0;
      const p = Number(editData.assistenciaPresencial) || 0;
      
      const docRef = doc(db, 'assistencias', editingId);
      
      // Atualiza o documento no Firestore com tratamento de erro e cálculo de total
      await updateDoc(docRef, {
        ...editData,
        assistenciaZoom: z,
        assistenciaPresencial: p,
        totalGeral: z + p
      });
      
      setEditingId(null);
      showNotification('success', 'Registro atualizado com sucesso!');
    } catch (err) {
      console.error('Erro ao atualizar registro:', err);
      showNotification('error', 'Erro ao salvar edição. Tente novamente.');
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
      console.error('Erro no Excel:', error);
      showNotification('error', 'Erro ao gerar Excel.');
    } finally {
      setIsExporting(false);
    }
  };

  // --- Exportar PDF ---
  const exportarPDF = async () => {
    if (!relatorioRef.current || !dadosFiltrados.length) return;
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
      console.error('Erro no PDF:', error);
      showNotification('error', 'Erro ao gerar PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-6">
      {/* Notificação Customizada */}
      <div aria-live="polite" className="fixed top-6 right-6 z-[100] pointer-events-none">
        {notification.message && (
          <div className={`pointer-events-auto px-6 py-3 rounded-xl shadow-2xl text-sm font-bold animate-in fade-in slide-in-from-top-4 duration-300 border backdrop-blur-md ${
            notification.type === 'error' ? 'bg-red-500/90 text-white border-red-400' : 
            notification.type === 'success' ? 'bg-emerald-600/90 text-white border-emerald-400' : 
            'bg-blue-600/90 text-white border-blue-400'
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
              <span className="hidden sm:inline">Excel</span>
            </button>
            <button
              onClick={exportarPDF}
              disabled={isExporting}
              className="p-3 bg-red-600 disabled:opacity-60 text-white rounded-xl hover:bg-red-700 active:scale-95 flex items-center justify-center gap-2 shadow-sm font-medium transition-all"
            >
              {isExporting ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
              <span className="hidden sm:inline">PDF</span>
            </button>
          </div>
        </div>
      </header>

      <section className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm" ref={relatorioRef}>
        <div className="p-5 bg-gray-50 border-b border-gray-100 font-bold text-gray-800 flex justify-between rounded-t-xl items-center">
          <span className="flex items-center gap-2">
            <FileText size={20} className="text-blue-600" />
            Resumo de Assistência
          </span>
          <span className="text-gray-500 font-normal text-sm">
            {filtroMesAno ? filtroMesAno.split('-').reverse().join('/') : 'Geral'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white text-gray-400 text-[10px] md:text-xs uppercase tracking-widest border-b border-gray-100">
                <th className="p-4 font-bold">Data / Lançamento</th>
                <th className="p-4 font-bold">Reunião / Indicadores</th>
                <th className="p-4 font-bold text-center">Zoom</th>
                <th className="p-4 font-bold text-center">Presencial</th>
                <th className="p-4 font-bold text-center text-blue-900 bg-blue-50/30">Total</th>
                <th className="p-4 font-bold text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {dadosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-gray-400 italic">
                    Nenhum registro encontrado para este período.
                  </td>
                </tr>
              ) : (
                dadosFiltrados.map((item) => (
                  <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    {editingId === item.id ? (
                      <td colSpan="6" className="p-4">
                        <div className="flex flex-col gap-3 bg-blue-50/50 p-6 rounded-2xl border border-blue-100 animate-in fade-in zoom-in-95 duration-300">
                          <h4 className="text-xs font-black text-blue-900 uppercase tracking-tighter mb-2">Modo Edição</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-blue-800 ml-1">DATA</label>
                              <input type="date" value={editData.dataReuniao} onChange={(e)=>setEditData({...editData, dataReuniao: e.target.value})} className="p-2.5 border border-blue-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-blue-800 ml-1">TIPO REUNIÃO</label>
                              <select value={editData.tipoReuniao} onChange={(e)=>setEditData({...editData, tipoReuniao: e.target.value})} className="p-2.5 border border-blue-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="Meio de Semana">Meio de Semana</option>
                                <option value="Fim de Semana">Fim de Semana</option>
                                <option value="Visita do Superintendente">Visita do Superintendente</option>
                                <option value="Comemoração da morte de Jesus">Comemoração da morte de Jesus</option>
                                <option value="Reunião especial com Betel">Reunião especial com Betel</option>
                              </select>
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-blue-800 ml-1">ZOOM</label>
                              <input type="number" value={editData.assistenciaZoom} onChange={(e)=>setEditData({...editData, assistenciaZoom: e.target.value})} className="p-2.5 border border-blue-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500" placeholder="Zoom" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-blue-800 ml-1">PRESENCIAL</label>
                              <input type="number" value={editData.assistenciaPresencial} onChange={(e)=>setEditData({...editData, assistenciaPresencial: e.target.value})} className="p-2.5 border border-blue-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500" placeholder="Presencial" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-blue-800 ml-1">INDICADOR ENT.</label>
                              <input type="text" value={editData.indicadorEntrada} onChange={(e)=>setEditData({...editData, indicadorEntrada: e.target.value.toUpperCase()})} className="p-2.5 border border-blue-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500" placeholder="Entrada" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-blue-800 ml-1">INDICADOR AUD.</label>
                              <input type="text" value={editData.indicadorAuditorio} onChange={(e)=>setEditData({...editData, indicadorAuditorio: e.target.value.toUpperCase()})} className="p-2.5 border border-blue-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500" placeholder="Auditório" />
                            </div>
                          </div>
                          <div className="flex justify-end gap-3 mt-4">
                            <button onClick={()=>setEditingId(null)} className="px-5 py-2.5 bg-white text-gray-600 border border-gray-200 font-bold rounded-xl hover:bg-gray-50 flex items-center gap-2 transition-all"><X size={18}/> Cancelar</button>
                            <button onClick={handleSaveEdit} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-2 transition-all shadow-lg"><Save size={18}/> Salvar Registro</button>
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
                              Postado: {new Date(item.dataCriacao).toLocaleString('pt-BR')}
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-gray-600 text-sm">
                          <div className="font-bold text-gray-800">{item.tipoReuniao ?? ''}</div>
                          <div className="text-[10px] md:text-xs text-gray-400 mt-1 uppercase tracking-tight">
                            <span className="text-blue-600 font-black">ENTRADA:</span> {item.indicadorEntrada || '-'} | <span className="text-blue-600 font-black">AUDITÓRIO:</span> {item.indicadorAuditorio || '-'}
                          </div>
                        </td>
                        <td className="p-4 text-center font-bold text-indigo-600">{item.assistenciaZoom ?? 0}</td>
                        <td className="p-4 text-center font-bold text-blue-600">{item.assistenciaPresencial ?? 0}</td>
                        <td className="p-4 text-center font-black text-emerald-600 bg-blue-50/30 text-base">
                          {item.totalGeral ?? (Number(item.assistenciaZoom || 0) + Number(item.assistenciaPresencial || 0))}
                        </td>
                        <td className="p-4 text-center">
                          <button 
                            onClick={() => handleEditClick(item)} 
                            className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm border border-blue-100 group"
                            title="Editar Dados"
                          >
                            <Edit2 size={16} className="group-hover:scale-110 transition-transform" />
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

      {/* Banner de Rodapé */}
      <div className="mt-8 rounded-2xl overflow-hidden h-32 relative border border-gray-100 shadow-sm">
        <ImageLoader docPath="settings/banner" fieldName="url" alt="Banner Rodapé" />
      </div>
    </div>
  );
}