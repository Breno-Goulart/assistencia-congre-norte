import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, getFirestore } from 'firebase/firestore';
import { FileSpreadsheet, FileText, Calendar, Loader2 } from 'lucide-react';
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
  const relatorioRef = useRef(null);

  // Obtém a instância do banco de dados (assume app Firebase já inicializado)
  const db = getFirestore();

  // --- Utilitários ---
  const yieldToBrowser = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 50)));

  const sanitizeFileName = (name) =>
    name
      .replace(/[^a-z0-9_\-\.]/gi, '_')
      .slice(0, 120); // limita para evitar nomes muito longos

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
        showNotification('error', 'Sessão expirada ou sem permissão. Faça login novamente.', 6000);
        setAssistencias([]);
      }
    );

    return () => {
      try {
        unsubscribe();
      } catch {
        // ignore
      }
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
      ws.getRow(1).height = 20;

      const rows = dadosFiltrados.map((item) => {
        const zoom = Number(item.assistenciaZoom ?? 0);
        const presencial = Number(item.assistenciaPresencial ?? 0);
        const total = Number(item.totalGeral ?? zoom + presencial);
        return {
          data: formatDateISOToBR(item.dataReuniao),
          reuniao: item.tipoReuniao ?? '',
          zoom,
          presencial,
          total,
          entrada: item.indicadorEntrada ?? '',
          auditorio: item.indicadorAuditorio ?? '',
        };
      });

      const CHUNK_SIZE = 200;
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        chunk.forEach((r) => ws.addRow(r));
        // yield to browser so it can process UI events and avoid long jank
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      ws.getColumn('zoom').numFmt = '0';
      ws.getColumn('presencial').numFmt = '0';
      ws.getColumn('total').numFmt = '0';

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const baseName = `Relatorio_Assistencia_${filtroMesAno || 'todos'}`;
      saveAs(blob, `${sanitizeFileName(baseName)}.xlsx`);
      showNotification('success', 'Excel gerado com sucesso.', 3000);
    } catch (error) {
      console.error('Erro ao gerar Excel:', error);
      showNotification('error', 'Não foi possível gerar o Excel. Veja o console.', 6000);
    } finally {
      setIsExporting(false);
    }
  };

  // --- Exportar PDF (alta qualidade com slicing) ---
  const exportarPDF = async () => {
    if (!relatorioRef.current) {
      showNotification('error', 'Elemento do relatório não encontrado.', 4000);
      return;
    }

    setIsExporting(true);
    let canvas = null;
    try {
      await yieldToBrowser();

      const element = relatorioRef.current;

      const targetDPI = 300;
      const cssPxPerInch = 96;
      const scale = Math.max(2, Math.round(targetDPI / cssPxPerInch));

      canvas = await html2canvas(element, {
        scale,
        useCORS: true,
        logging: false,
        allowTaint: false,
        useFontFace: true,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png', 1.0);

      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const pxToMm = (px) => (px * 25.4) / cssPxPerInch;

      const imgWidthPx = canvas.width;
      const imgHeightPx = canvas.height;
      const imgWidthMm = pxToMm(imgWidthPx);
      const imgHeightMm = pxToMm(imgHeightPx);

      const scaleToFitWidth = pageWidth / imgWidthMm;
      const finalImgWidthMm = imgWidthMm * scaleToFitWidth;
      const finalImgHeightMm = imgHeightMm * scaleToFitWidth;

      // Prepare baseName once to avoid duplicate declarations
      const baseName = `Relatorio_Assistencia_${filtroMesAno || 'todos'}`;

      // If the scaled image fits in a single page, add it centered
      if (finalImgHeightMm <= pageHeight) {
        pdf.addImage(
          imgData,
          'PNG',
          (pageWidth - finalImgWidthMm) / 2,
          (pageHeight - finalImgHeightMm) / 2,
          finalImgWidthMm,
          finalImgHeightMm
        );

        pdf.save(`${sanitizeFileName(baseName)}.pdf`);
        showNotification('success', 'PDF gerado com sucesso.', 3000);
        return;
      }

      // Pagination: compute page height in px at canvas scale
      const pageHeightPx = Math.round((pageHeight * cssPxPerInch) / 25.4);
      let remainingHeightPx = imgHeightPx;
      let offsetY = 0;

      while (remainingHeightPx > 0) {
        const sliceHeightPx = Math.min(pageHeightPx, remainingHeightPx);

        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = imgWidthPx;
        tmpCanvas.height = sliceHeightPx;
        let ctx = tmpCanvas.getContext('2d');

        ctx.drawImage(canvas, 0, offsetY, imgWidthPx, sliceHeightPx, 0, 0, imgWidthPx, sliceHeightPx);

        const sliceData = tmpCanvas.toDataURL('image/png', 1.0);

        const sliceHeightMm = pxToMm(sliceHeightPx) * scaleToFitWidth;
        const sliceWidthMm = finalImgWidthMm;

        pdf.addImage(sliceData, 'PNG', (pageWidth - sliceWidthMm) / 2, 0, sliceWidthMm, sliceHeightMm);

        // free temporary canvas memory
        try {
          // clear pixels and release references
          ctx && ctx.clearRect(0, 0, tmpCanvas.width, tmpCanvas.height);
        } catch {}
        // drop references to help GC
        ctx = null;
        tmpCanvas.width = 0;
        tmpCanvas.height = 0;

        remainingHeightPx -= sliceHeightPx;
        offsetY += sliceHeightPx;

        if (remainingHeightPx > 0) pdf.addPage();

        // yield to keep UI responsive on large documents
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      pdf.save(`${sanitizeFileName(baseName)}.pdf`);
      showNotification('success', 'PDF gerado com sucesso.', 3000);
    } catch (error) {
      console.error('Erro ao gerar PDF de alta qualidade:', error);
      showNotification('error', 'Não foi possível gerar o PDF. Veja o console.', 6000);
    } finally {
      // cleanup canvas memory references
      try {
        if (canvas) {
          canvas.width = 0;
          canvas.height = 0;
        }
      } catch {
        // ignore
      }
      // drop reference
      // eslint-disable-next-line no-unused-expressions
      canvas = null;
      setIsExporting(false);
    }
  };

  return (
    <div className="p-6">
      {/* Notificação acessível */}
      <div
        aria-live="polite"
        className="fixed top-6 right-6 z-50"
        style={{ pointerEvents: 'none' }}
      >
        {notification.message && (
          <div
            className={`pointer-events-auto px-4 py-2 rounded-md shadow-md text-sm font-medium ${
              notification.type === 'error'
                ? 'bg-red-50 text-red-700 border border-red-100'
                : notification.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-100'
                : 'bg-blue-50 text-blue-700 border border-blue-100'
            }`}
          >
            {notification.message}
          </div>
        )}
      </div>

      <header className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Relatório de Assistências</h1>
          <p className="text-sm text-gray-500">Visualize e exporte os registros por mês.</p>
        </div>

        {/* Toolbar com filtro e exportações */}
        <div className="w-full sm:w-auto">
          <div className="grid grid-cols-2 md:flex items-center gap-3 w-full md:w-auto">
            <input
              type="month"
              value={filtroMesAno}
              onChange={(e) => setFiltroMesAno(e.target.value)}
              className="col-span-2 md:col-span-1 p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none w-full shadow-sm"
              aria-label="Filtrar por mês e ano"
            />
            <button
              onClick={exportarExcel}
              disabled={isExporting}
              aria-disabled={isExporting}
              tabIndex={isExporting ? -1 : 0}
              className="p-3 bg-emerald-600 disabled:opacity-60 text-white rounded-xl hover:bg-emerald-700 active:scale-95 flex items-center justify-center gap-2 shadow-sm font-medium transition-all"
            >
              {isExporting ? <Loader2 className="animate-spin" size={18} /> : <FileSpreadsheet size={18} />}
              <span>{isExporting ? 'Exportando...' : 'Excel'}</span>
            </button>
            <button
              onClick={exportarPDF}
              disabled={isExporting}
              aria-disabled={isExporting}
              tabIndex={isExporting ? -1 : 0}
              className="p-3 bg-red-600 disabled:opacity-60 text-white rounded-xl hover:bg-red-700 active:scale-95 flex items-center justify-center gap-2 shadow-sm font-medium transition-all"
            >
              {isExporting ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
              <span>{isExporting ? 'Exportando...' : 'PDF'}</span>
            </button>
          </div>
        </div>
      </header>

      <section
        className="bg-white border border-gray-100 rounded-xl p-4"
        ref={relatorioRef}
        aria-busy={isExporting}
      >
        <div className="p-5 bg-gray-50 border-b border-gray-100 font-bold text-gray-800 flex justify-between">
          <span>Resumo de Assistência</span>
          <span className="text-gray-500 font-normal">
            {filtroMesAno ? filtroMesAno.split('-').reverse().join('/') : 'Todos'}
          </span>
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
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-400">
                    Nenhum dado encontrado para este mês.
                  </td>
                </tr>
              ) : (
                dadosFiltrados.map((item) => (
                  <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="p-4 text-gray-800 font-medium">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-gray-400" />
                        {formatDateISOToBR(item.dataReuniao)}
                      </div>
                    </td>
                    <td className="p-4 text-gray-600">{item.tipoReuniao ?? ''}</td>
                    <td className="p-4 text-center font-medium text-indigo-600">{item.assistenciaZoom ?? 0}</td>
                    <td className="p-4 text-center font-medium text-blue-600">{item.assistenciaPresencial ?? 0}</td>
                    <td className="p-4 text-center font-black text-emerald-600 bg-blue-50/30">
                      {item.totalGeral ?? (Number(item.assistenciaZoom || 0) + Number(item.assistenciaPresencial || 0))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Exibição da imagem/carrossel no topo */}
      <div className="mt-6">
        <div className="mb-6">
          <ImageLoader />
        </div>
      </div>
    </div>
  );
}
