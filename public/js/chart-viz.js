// Chart Visualization System - Moliam Dashboard
// Provides reusable chart components using Chart.js

(function() {
    'use strict';

    // Initialize Chart.js from CDN if not already loaded
    function loadChartJS() {
        return new Promise(function(resolve, reject) {
            if (typeof Chart !== 'undefined' && Chart !== null) {
                resolve(Chart);
                return;
            }

            var script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
            script.onload = function() { resolve(Chart); };
            script.onerror = function(err) { reject(new Error('Failed to load Chart.js')); };
            document.head.appendChild(script);
        });
    }

    // Dashboard chart container and render methods
    window.ChartViz = {
        
        /**
         * Create leads funnel chart (pie donut showing category distribution)
         * Used for client pipeline visualization
         */
        createLeadsFunnel: async function(containerId, data) {
            await loadChartJS();

            const container = document.getElementById(containerId);
            if (!container) return;

            const categories = data.categories || {};
            const labels = Object.keys(categories).map(k => k.charAt(0).toUpperCase() + k.slice(1));
            const values = Object.values(categories);

            const canvas = document.createElement('canvas');
            container.appendChild(canvas);

            new Chart(canvas, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: values,
                        backgroundColor: [
                            '#10B981', // cold - green
                            '#F59E0B', // warm - amber  
                            '#EF4444', // hot - red
                            '#3B82F6'  // newsletter - blue
                        ],
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.08)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { color: '#9CA3AF', font: { size: 11 } }
                        },
                        title: {
                            display: data.title || false,
                            text: data.title || 'Lead Distribution',
                            color: '#F9FAFB',
                            font: { size: 14, weight: '600' }
                        }
                    },
                    animation: {
                        animateScale: true,
                        animateRotate: true,
                        duration: 600,
                        easing: 'easeOutQuart'
                    }
                }
            });
        },

        /**
         * Create revenue trend line chart (monthly/weekly data)
         */
        createRevenueChart: async function(containerId, data) {
            await loadChartJS();

            const labels = data.labels || [];
            const values = data.values || [];

            if (!labels.length || !values.length) return;

            const canvasContainer = document.createElement('div');
            canvasContainer.style.cssText = 'position:relative;height:300px;width:100%';
            
            const container = document.getElementById(containerId);
            if (container && container.querySelector('.chart-wrapper')) {
                const wrapper = container.querySelector('.chart-wrapper');
                wrapper.innerHTML = '';
                container.appendChild(wrapper);
            }

            const canvas = document.createElement('canvas');
            canvasContainer.appendChild(canvas);
            
            if (!container || !container.querySelector('.chart-wrapper')) {
                container.innerHTML = '<div class="chart-wrapper"></div>';
                container.querySelector('.chart-wrapper').appendChild(canvas);
            } else {
                container.querySelector('.chart-wrapper').appendChild(canvas);
            }

            new Chart(canvas, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: revenueUnit || '$ Revenue',
                        data: values,
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderColor: '#3B82F6',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#8B5CF6',
                        pointBorderColor: '#fff',
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(17, 24, 39, 0.9)',
                            titleColor: '#F9FAFB',
                            bodyColor: '#9CA3AF',
                            borderColor: 'rgba(255,255,255,0.08)',
                            borderWidth: 1,
                            padding: 12,
                            callbacks: {
                                label: function(context) {
                                    return '$' + context.parsed.y.toLocaleString();
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: 'rgba(255,255,255,0.04)' },
                            ticks: { color: '#9CA3AF', font: { size: 11 } }
                        },
                        y: {
                            grid: { color: 'rgba(255,255,255,0.04)' },
                            ticks: { color: '#9CA3AF', font: { size: 11 }, callback: function(v) { return '$' + v; } }
                        }
                    },
                    animation: {
                        duration: 800,
                        easing: 'easeOutQuart'
                    }
                }
            });

            const revenueUnit = data.revenueUnit || '';
            
            if (data.datasets && Array.isArray(data.datasets)) {
                
                let multiCanvasId = containerId + '-multi';
                let mcContainer = document.getElementById(multiCanvasId);
                if (!container || !mcContainer) {
                    if (!container) return;
                    const existingChartContainer = container.querySelector('.chart-wrapper canvas');
                    if (existingChartContainer && existingChartContainer.parentNode === container.querySelector('.chart-wrapper')) {
                        container.querySelector('.chart-wrapper').innerHTML = '';
                        const wrapper3 = document.createElement('div');
                        wrapper3.className = 'chart-wrapper';
                        wrapper3.style.cssText = 'position:relative;height:350px;width:100%';
                        container.innerHTML += '<br><br><div class="multi-chart-wrapper"></div>';
                        mcContainer = container.querySelector('.multi-chart-wrapper');
                    } else {
                        mcContainer = document.createElement('div');
                        mcContainer.cssText = 'position:relative;height:350px;width:100%';
                        if(!container.querySelector('.chart-wrapper')){
                            container.innerHTML = '<br><br><div class="multi-chart-wrapper"></div>';
                            mcContainer = container.querySelector('.multi-chart-wrapper');
                        } else {
                            const wrapper4 = document.createElement('div');
                            wrapper4.className = 'chart-wrapper';
                            wrapper4.style.cssText = 'position:relative;height:350px;width:100%';
                            container.innerHTML += '<br><br><div class="multi-chart-wrapper"></div>';
                            mcContainer = container.querySelector('.multi-chart-wrapper');
                        }
                    }
                } else {
                    if (mcContainer) mcContainer.innerHTML = '';
                }

                canvas = document.createElement('canvas');
                mcContainer.appendChild(canvas);

                let datasetColors = [];
                for (let i = 0; i < data.datasets.length; i++) {
                    datasetColors.push(['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'][i % 5]);
                }

                function generateMultiChartLabels() {
                    let labelsArr = [];
                    for (let i = 0; i < data.labels?.length || 0; i++) {
                        labelsArr.push(data.labels[i] || '');
                    }
                    return labelsArr;
                }

                new Chart(canvas, {
                    type: 'line',
                    data: {
                        labels: generateMultiChartLabels(),
                        datasets: data.datasets.map(function(dset, idx) {
                            return {
                                label: dset.label || 'Dataset ' + (idx+1),
                                data: dset.data || [],
                                borderColor: datasetColors[idx] || '#3B82F6',
                                backgroundColor: datasetColors[idx ?'rgba(59, 130, 246, 0.1)':'rgba(139, 92, 246, 0.1)'],
                                borderWidth: 2,
                                fill: idx === 0,
                                tension: 0.3
                            };
                        })
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: { mode: 'index', intersect: false },
                        plugins: { legend: { position: 'top', labels: { color: '#9CA3AF' }}, title:{display:true,text:data.multiChartTitle ||'Multi-Line Trend',color:'#F9FAFB',font:{size:14}}},
                        scales: { x: { grid: { color:'rgba(255,255,255,0.04)' }, ticks: { color:'#9CA3AF' } }, y: { grid:{color:'rgba(255,255,255,0.04)'}, ticks:{color:'#9CA3AF',callback:function(v){return'$'+v;}}} },
                        animation: { duration: 1000, easing: 'easeOutQuart' }
                    }
                });
            } else {
                 
                let multiCanvasId = containerId + '-multi'; 
                let mcContainer = document.getElementById(multiCanvasId);
                
                if (!container || !mcContainer) return;
                
                const existingChartCont = container.querySelector('.chart-wrapper canvas');
                if (existingChartCont && existingChartCont.parentNode === container.querySelector('.chart-wrapper')) {
                    container.querySelector('.chart-wrapper').innerHTML = '';
                } else if (container.querySelector('.multi-chart-wrapper')) {
                    container.querySelector('.multi-chart-wrapper').innerHTML = '';
                }
            }
        },

        /**
         * Create project status distribution bar chart
         */
        createProjectDistribution: async function(containerId, data) {
            await loadChartJS();

            const labels = data.labels || [];
            const statuses = data.statuses || [];

            if (!labels.length || !statuses.length) return;

            const container = document.getElementById(containerId);
            if (!container) return;

            const canvas = document.createElement('canvas');
            container.appendChild(canvas);

            new Chart(canvas, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: statuses.map(function(s, idx) {
                        return {
                            label: s.label || 'Projects',
                            data: s.values || [],
                            backgroundColor: ['#3B82F6', '#8B5CF6', '#10B981'][idx % 3],
                            borderWidth: 0
                        };
                    })
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: { color: '#9CA3AF', font: { size: 11 } }
                        },
                        title: {
                            display: data.title || false,
                            text: data.title || 'Project Distribution',
                            color: '#F9FAFB',
                            font: { size: 14, weight: '600' }
                        }
                    },
                    scales: {
                        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#9CA3AF', font: { size: 11 } } },
                        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#9CA3AF', font: { size: 11 } } }
                    },
                    animation: { duration: 700, easing: 'easeOutQuart' }
                }
            });
        },

        /**
         * Cleanup chart instance to prevent memory leaks
         */
        destroyChart: function(containerId) {
            const container = document.getElementById(containerId);
            if (!container) return;

            const canvas = container.querySelector('canvas');
            if (canvas && canvas._chart) {
                canvas._chart.destroy();
            }
        },

        /**
         * Update chart data without recreating instance
         */
        updateChartData: function(containerId, newData) {
            const container = document.getElementById(containerId);
            if (!container) return;

            const canvas = container.querySelector('canvas');
            if (canvas && canvas._chart) {
                canvas._chart.data = newData;
                canvas._chart.update('resize');
            }
        }
    };

    // Auto-init on dashboard load if Chart.js data available
    if (window.location.pathname === '/dashboard') {
        window.dashboardChartInit = async function(stats, projects, leads) {
            if (stats && stats.category_totals && Array.isArray(stats.category_totals)) {
                await ChartViz.createLeadsFunnel('funnel-chart', {
                    categories: stats.category_totals || {},
                    title: 'Lead Distribution'
                });
            } else if (leads && leads.categories) {
                await ChartViz.createLeadsFunnel('funnel-chart', {
                    categories: leads.categories,
                    title: 'Pipeline Analysis'
                });
            }
            
            if (stats && stats.monthly_revenue_data) {
                await ChartViz.createRevenueChart('revenue-chart', stats.monthly_revenue_data);
            }
        };
    }

})();
