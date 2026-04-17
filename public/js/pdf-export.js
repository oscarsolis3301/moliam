// Dashboard PDF Export Module - Moliam Project
// Client-side PDF generation for invoices, project reports, and dashboard data
// Uses jsPDF library from CDN (lazy-loaded), creates professional client-facing documents

(function() {
    'use strict';

    let jsPDF = null;
    let pdfLoaded = false;

    // Load jsPDF library from CDN if not already loaded
    function loadjsPDF() {
        return new Promise(function(resolve, reject) {
            if (typeof window.jsPDF !== 'undefined' && window.jsPDF !== null) {
                jsPDF = window.jsPDF;
                pdfLoaded = true;
                resolve(jsPDF);
                return;
            }

            var script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload = function() {
                if (typeof window.jsPDF !== 'undefined' && window.jsPDF !== null) {
                    jsPDF = window.jsPDF;
                    pdfLoaded = true;
                    resolve(jsPDF);
                } else {
                    reject(new Error('Failed to load jsPDF library'));
                }
            };
            script.onerror = function(err) {
                reject(new Error('Failed to load jsPDF: ' + err.message));
            };
            document.head.appendChild(script);
        });
    }

    // Dashboard PDF Export Manager
    window.DashboardPdfExport = {

        /**
         * Generate invoice PDF report for current client
         * @param {Array} invoices - Invoice data array from API
         * @returns {Promise<string}>} Base64-encoded PDF document
         */
        generateInvoiceReport: async function(invoices) {
            if (!invoices || invoices.length === 0) {
                return null;
            }

            await loadjsPDF();

            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            // Add Moliam branding header
            const pageHeight = doc.internal.pageSize.getHeight();
            const pageWidth = doc.internal.pageSize.getWidth();

            // Header gradient background (using fill color approximation)
            doc.setFillColor(59, 130, 246); // --accent-blue
            doc.rect(0, 0, pageWidth, 25, 'F');

            // White text for title
            doc.setTextColor(249, 250, 251); // --text-primary
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(20);
            doc.text('MOLIAMA', pageWidth / 2, 12, { align: 'center' });

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text('Invoice Report', pageWidth / 2, 18, { align: 'center' });

            // Add timestamp
            doc.setTextColor(156, 163, 175); // --text-secondary
            doc.setFontSize(8);
            const now = new Date();
            doc.text('Generated: ' + now.toLocaleDateString() + ' ' + now.toLocaleTimeString(), pageWidth / 2, 22, { align: 'center' });

            // Calculate totals
            let totalBilled = 0;
            let totalPaid = 0;
            const outstanding = [];

            for (const inv of invoices) {
                const amt = inv.amount || 0;
                totalBilled += amt;
                if (inv.status === 'paid') {
                    totalPaid += amt;
                } else {
                    outstanding.push(inv);
                }
            }

            // Section: Summary
            doc.setTextColor(249, 250, 251);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('Summary', 15, 32);

            const summaryY = 38;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(156, 163, 175);

            doc.text('Total Billed:', 15, summaryY);
            doc.setTextColor(249, 250, 251);
            doc.text('$' + totalBilled.toLocaleString(), 70, summaryY);

            doc.setTextColor(16, 185, 129); // --accent-green for paid status
            doc.text('Total Paid: $' + totalPaid.toLocaleString(), 100, summaryY);

            const outstandingAmt = totalBilled - totalPaid;
            if (outstanding.length > 0) {
                doc.setTextColor(245, 158, 11); // --accent-amber for pending
                doc.text('Outstanding: $' + outstandingAmt.toLocaleString(), 70, summaryY + 6);
            }

            // Section: Invoice Details Table
            const startY = 50;
            const maxRows = Math.floor((pageHeight - 25) / 15);

            doc.setTextColor(249, 250, 251);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('Invoice Details', 15, 46);

            // Table header
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            textColorBlue();
            const colX = [15, 40, 70, 100, 140];
            const colW = [25, 30, 30, 30, 35];
            const headers = ['', 'Client', 'Amount', 'Status', 'Date'];

            for (let i = 0; i < headers.length && i < colX.length; i++) {
                if (i > 0) doc.text(headers[i], colX[i] + colW[i-1] / 2, startY + 7, { align: 'center' });
            }

            // Draw header underline
            doc.setLineStyle(0.5);
            doc.line(15, startY + 9, 140, startY + 9);

            // Invoice rows
            let currentY = startY + 12;
            const textColorBlue = function() {
                doc.setTextColor(59, 130, 246);
            };

            for (let i = 0; i < invoices.length && i < maxRows - 1; i++) {
                const inv = invoices[i];
                const amt = inv.amount || 0;

                if (currentY > pageHeight - 15) {
                    doc.addPage();
                    currentY = 25;
                }

                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                textColorBlue();

                const invId = String(inv.id || '').slice(-4);
                doc.text(invId, colX[0] + colW[0] / 2, currentY, { align: 'center' });
                doc.setTextColor(249, 250, 251);
                doc.text(inv.client_name || 'N/A', colX[1] + 5, currentY);

                doc.setTextColor(245, 158, 11); // Status color based on invoice
                const paidStatus = inv.status === 'paid' ? '#10B981' : '#EF4444';
                if (inv.status === 'paid') {
                    doc.setTextColor(16, 185, 129);
                } else {
                    doc.setTextColor(239, 68, 68);
                }

                doc.text('$' + amt.toLocaleString(), colX[3] + colW[2] / 2, currentY, { align: 'center' });
                doc.setTextColor(156, 163, 175);
                const invDate = inv.created_at ? new Date(inv.created_at).toDateString() : new Date().toDateString();
                doc.text(invDate.slice(0, 3) + ' ' + invDate.slice(5, 7) + ' ' + invDate.slice(8), colX[4] - 10, currentY);

                currentY += 10;
            }

            // Footer
            doc.setTextColor(156, 163, 175);
            doc.setFontSize(7);
            doc.text('--- End of Report ---', pageWidth / 2, pageHeight - 10, { align: 'center' });
            doc.text('Questions? Contact billing@moliama.com', pageWidth / 2, pageHeight, { align: 'center' });

            // Save as base64 for display or download
            return doc.output('datauristring');
        },

        /**
         * Export project report for a single project
         * @param {Object} project - Project data object
         * @returns {Promise<string>} Base64-encoded PDF document
         */
        generateProjectReport: async function(project) {
            if (!project) return null;

            await loadjsPDF();

            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const pageWidth = doc.internal.pageSize.getWidth();

            // Header with project status color
            let headerColor = [59, 130, 246]; // blue default
            if (project.status === 'active') {
                headerColor = [16, 185, 129]; // green
            } else if (project.status === 'in-progress' || project.status === 'completed') {
                headerColor = [245, 158, 11]; // amber
            }

            doc.setFillColor(headerColor[0], headerColor[1], headerColor[2]);
            doc.rect(0, 0, pageWidth, 30, 'F');

            doc.setTextColor(249, 250, 251);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(18);
            doc.text('Project Overview', pageWidth / 2, 17, { align: 'center' });

            doc.setFontSize(14);
            doc.text(project.name || project.type || 'Untitled Project', pageWidth / 2, 23, { align: 'center' });

            // Project details section
            const startY = 40;
            doc.setTextColor(249, 250, 251);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Project Information', 15, startY);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(156, 163, 175);

            let y = startY + 6;
            const labels = ['Type:', 'Status:', 'Monthly Rate:', 'Started:'];
            const values = [
                project.type || '-',
                project.status || '-',
                '$' + (project.monthly_rate || 0).toLocaleString(),
                new Date(project.created_at).toLocaleDateString()
            ];

            for (let i = 0; i < labels.length; i++) {
                doc.text(labels[i], 15, y);
                doc.setTextColor(249, 250, 251);
                doc.text(values[i], 45, y);
                y += 6;
            }

            // Footer
            doc.setTextColor(156, 163, 175);
            doc.setFontSize(7);
            doc.text('--- Project Report ---', pageWidth / 2, 70, { align: 'center' });

            return doc.output('datauristring');
        },

        /**
         * Download PDF as file to user's computer
         * @param {string} base64Doc - Base64-encoded PDF document
         * @param {string} filename - Suggested filename (without extension)
         */
        downloadPDF: function(base64Doc, filename) {
            if (!base64Doc || !filename) return;

            const link = document.createElement('a');
            link.href = base64Doc;
            link.download = filename.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.pdf';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            console.log('[PDF Export]: Downloaded', link.download);
        },

        /**
         * Open PDF in new tab/window
         * @param {string} base64Doc - Base64-encoded PDF document
         */
        previewPDF: function(base64Doc) {
            if (!base64Doc) return;

            const win = window.open('', '_blank');
            if (win) {
                win.document.write('<iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;" src="' + base64Doc + '"></iframe>');
            } else {
                window.location.href = base64Doc;
            }
        },

        /**
         * Export invoices to PDF with full detail including client data
         * @param {Object} context - Dashboard context object with invoices and stats
         */
        exportInvoicesToPDF: async function(context) {
            const invoices = context.invoices || [];
            if (invoices.length === 0) {
                alert('No invoices to export. Generating sample report...');
                return await this.generateSampleInvoicePDF();
            }

            const base64 = await DashboardPdfExport.generateInvoiceReport(invoices);
            if (base64) {
                DashboardPdfExport.downloadPDF(base64, 'invoices-report-' + new Date().toISOString().slice(0, 10));
            }
        },

        /**
         * Generate sample invoice PDF for testing/demonstration
         */
        generateSampleInvoicePDF: async function() {
            await loadjsPDF();

            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const pageWidth = doc.internal.pageSize.getWidth();

            // Header
            doc.setFillColor(59, 130, 246);
            doc.rect(0, 0, pageWidth, 25, 'F');

            doc.setTextColor(249, 250, 251);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(18);
            doc.text('Sample Invoice Report', pageWidth / 2, 15, { align: 'center' });

            doc.setFontSize(10);
            doc.setTextColor(156, 163, 175);
            doc.text('Demo - For testing PDF generation', pageWidth / 2, 21, { align: 'center' });

            // Sample invoice data
            const sampleInvoices = [
                { id: 1001, client_name: 'Client Alpha', amount: 5000, status: 'paid', created_at: new Date(Date.now() - 86400000 * 15).toISOString() },
                { id: 1002, client_name: 'Client Beta', amount: 3500, status: 'pending', created_at: new Date(Date.now() - 86400000 * 7).toISOString() },
                { id: 1003, client_name: 'Client Gamma', amount: 7200, status: 'paid', created_at: new Date(Date.now() - 86400000 * 3).toISOString() }
            ];

            // Summary section
            doc.setTextColor(249, 250, 251);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Summary', 15, 38);

            let total = 0;
            for (const inv of sampleInvoices) total += inv.amount;

            doc.setTextColor(156, 163, 175);
            doc.setFontSize(9);
            doc.text('Total Billed: $' + total.toLocaleString(), 15, 46);

            // Invoice details
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Invoice Details', 15, 58);

            let y = 66;
            doc.setTextColor(156, 163, 175);
            doc.setFontSize(8);
            doc.line(15, 62, pageWidth - 15, 62);

            for (const inv of sampleInvoices) {
                if (inv.id > 0 && y < pageHeight - 15) {
                    doc.setTextColor(59, 130, 246);
                    doc.text(String(inv.id).slice(-4), 18, y);
                    doc.setTextColor(249, 250, 251);
                    doc.text(inv.client_name, 45, y);

                    if (inv.status === 'paid') {
                        doc.setTextColor(16, 185, 129);
                    } else {
                        doc.setTextColor(239, 68, 68);
                    }
                    doc.text('$' + inv.amount.toLocaleString(), 80, y);

                    const date = new Date(inv.created_at);
                    doc.setTextColor(156, 163, 175);
                    doc.text(date.toDateString().slice(0, 3) + ' ' + date.getDate() + ' ' + date.toLocaleDateString().slice(5, 7), 100, y);

                    y += 8;
                }
            }

            doc.setTextColor(156, 163, 175);
            doc.setFontSize(7);
            doc.text('--- End of Sample Report ---', pageWidth / 2, pageHeight - 10, { align: 'center' });

            return doc.output('datauristring');
        }
    };

    // Auto-wire dashboard invoice links when on dashboard page
    if (window.location.pathname === '/dashboard') {
        document.addEventListener('DOMContentLoaded', function() {
            const invoiceLinks = document.querySelectorAll('a[href*="/api/invoices?export=pdf"]');

            for (const link of invoiceLinks) {
                link.addEventListener('click', function(e) {
                    e.preventDefault();

                    DashboardPdfExport.exportInvoicesToPDF(window.dashboardData || {});
                });
            }
        }, false);
    }

})();
