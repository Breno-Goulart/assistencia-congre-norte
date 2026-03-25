import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, getFirestore } from 'firebase/firestore';
import { FileSpreadsheet, FileText, Calendar, Loader2 } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function Dashboard() {
  const [assistencias, setAssistencias] = useState([]);
  const [filtroMesAno, setFiltroMesAno] = useState('');
  const [isExporting, setIsExporting] = useState(false);
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

  // small helper to yield to the browser so UI updates (spinner) can render
  const yieldToBrowser = () => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 50)));

  const exportarExcel = async () => {
    if (!dadosFiltrados || dadosFiltrados.length === 0) {
      alert('Nenhum dado para exportar.');
      return;
    }

    setIsExporting(true);
    try {
      // allow spinner to render
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
        { header: 'Auditório', key: 'auditorio', width: 20 }
      ];

      // Estilizar cabeçalho
      ws.getRow(1).font = { bold: true };
      ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
      ws.getRow(1).height = 20;

      // Add rows in small chunks to avoid blocking the main thread for long
      const rows = dadosFiltrados.map(item => ({
        data: item.dataReuniao.split('-').reverse().join('/'),
        reuniao: item.tipoReuniao,
        zoom: Number(item.assistenciaZoom ?? 0),
        presencial: Number(item.assistenciaPresencial ?? 0),
        total: Number(item.totalGeral ?? (Number(item.assistenciaZoom || 0) + Number(item.assistenciaPresencial || 0))),
        entrada: item.indicadorEntrada ?? '',
        auditorio: item.indicadorAuditorio ?? ''
      }));

      const CHUNK_SIZE = 200; // adjust if needed
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        chunk.forEach(r => ws.addRow(r));
        // yield to browser so it can process UI events and avoid long jank
        // small timeout keeps UI responsive
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Formatação numérica
      ws.getColumn('zoom').numFmt = '0';
      ws.getColumn('presencial').numFmt = '0';
      ws.getColumn('total').numFmt = '0';

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `Relatorio_Assistencia_${filtroMesAno || 'todos'}.xlsx`);
    } catch (error) {
      console.error('Erro ao gerar Excel:', error);
      alert('Não foi possível gerar o Excel. Verifique o console para mais detalhes.');
    } finally {
      setIsExporting(false);
    }
  };

  // High-quality PDF export: PNG at target DPI, pagination, memory-friendly slicing
  const exportarPDF = async () => {
    if (!relatorioRef.current) {
      alert('Elemento do relatório não encontrado.');
      return;
    }

    setIsExporting(true);
    try {
      // allow spinner to render
      await yieldToBrowser();

      const element = relatorioRef.current;

      // Quality parameters
      const targetDPI = 300; // 300 DPI for high-quality print
      const cssPxPerInch = 96; // CSS reference
      const scale = Math.max(2, Math.round(targetDPI / cssPxPerInch)); // e.g., 300/96 ≈ 3

      // Render element to canvas in high resolution
      const canvas = await html2canvas(element, {
        scale,
        useCORS: true,
        logging: false,
        allowTaint: false,
        useFontFace: true,
        backgroundColor: '#ffffff'
      });

      // Use PNG for best text/vector sharpness
      const imgData = canvas.toDataURL('image/png', 1.0);

      // Prepare PDF A4 landscape in mm
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Helper: px -> mm
      const pxToMm = px => (px * 25.4) / cssPxPerInch;

      const imgWidthPx = canvas.width;
      const imgHeightPx = canvas.height;
      const imgWidthMm = pxToMm(imgWidthPx);
      const imgHeightMm = pxToMm(imgHeightPx);

      // Scale to fit page width while keeping aspect ratio
      const scaleToFitWidth = pageWidth / imgWidthMm;
      const finalImgWidthMm = imgWidthMm * scaleToFitWidth;
      const finalImgHeightMm = imgHeightMm * scaleToFitWidth;

      // If fits in one page, add and save
      if (finalImgHeightMm <= pageHeight) {
        pdf.addImage(imgData, 'PNG', (pageWidth - finalImgWidthMm) / 2, (pageHeight - finalImgHeightMm) / 2, finalImgWidthMm, finalImgHeightMm);
        pdf.save(`Relatorio_Assistencia_${filtroMesAno || 'todos'}.pdf`);
        return;
      }

      // Pagination: determine slice height in px corresponding to one PDF page height
      // Convert pageHeight (mm) to px at the canvas scale
      const pageHeightPx = Math.round((pageHeight * cssPxPerInch) / 25.4 * (canvas.width / imgWidthPx)); // safe approximation

      // Process slices top -> bottom to avoid huge memory spikes
      let remainingHeightPx = imgHeightPx;
      let offsetY = 0;

      while (remainingHeightPx > 0) {
        const sliceHeightPx = Math.min(pageHeightPx, remainingHeightPx);

        // Create temporary canvas for the slice
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = imgWidthPx;
        tmpCanvas.height = sliceHeightPx;
        const ctx = tmpCanvas.getContext('2d');

        // Draw slice from original canvas
        ctx.drawImage(canvas, 0, offsetY, imgWidthPx, sliceHeightPx, 0, 0, imgWidthPx, sliceHeightPx);

        // Convert slice to PNG
        const sliceData = tmpCanvas.toDataURL('image/png', 1.0);

        // Dimensions in mm for the slice (apply same width scaling)
        const sliceHeightMm = pxToMm(sliceHeightPx) * scaleToFitWidth;
        const sliceWidthMm = finalImgWidthMm;

        // Add slice to PDF (centered horizontally)
        pdf.addImage(sliceData, 'PNG', (pageWidth - sliceWidthMm) / 2, 0, sliceWidthMm, sliceHeightMm);

        // Free temporary canvas memory
        tmpCanvas.width = 0;
        tmpCanvas.height = 0;

        remainingHeightPx -= sliceHeightPx;
        offsetY += sliceHeightPx;

        if (remainingHeightPx > 0) pdf.addPage();

        // yield to keep UI responsive on large documents
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      pdf.save(`Relatorio_Assistencia_${filtroMesAno || 'todos'}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar PDF de alta qualidade:', error);
      alert('Não foi possível gerar o PDF. Verifique o console para mais detalhes.');
    } finally {
      setIsExporting(false);
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
            type="month"
            value={filtroMesAno}
            onChange={(e) => setFiltroMesAno(e.target.value)}
            className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none w-full md:w-auto"
          />
          <button
            onClick={exportarExcel}
            disabled={isExporting}
            className="p-2 bg-emerald-600 disabled:opacity-60 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 shadow-sm font-medium transition-colors"
          >
            {isExporting ? <Loader2 className="animate-spin" size={18} /> : <FileSpreadsheet size={18} />}
            <span>{isExporting ? 'Exportando...' : 'Excel'}</span>
          </button>
          <button
            onClick={exportarPDF}
            disabled={isExporting}
            className="p-2 bg-red-600 disabled:opacity-60 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 shadow-sm font-medium transition-colors"
          >
            {isExporting ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
            <span>{isExporting ? 'Exportando...' : 'PDF'}</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden" ref={relatorioRef}>
        <div className="p-5 bg-gray-50 border-b border-gray-100 font-bold text-gray-800 flex justify-between">
          <span>Resumo de Assistência</span>
          <span className="text-gray-500 font-normal">{filtroMesAno ? filtroMesAno.split('-').reverse().join('/') : 'Todos'}</span>
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
