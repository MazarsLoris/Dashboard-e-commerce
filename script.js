"use strict";

const e = React.createElement;
const { useState, useEffect, useRef } = React;

// ========== HELPERS DE PARSING (VOS LOGIQUES ORIGINALES) ==========
const parseCSV = (csv) => {
    const lines = csv.split('\n');
    if (lines.length <= 1) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).filter(l => l.trim()).map(line => {
        const values = line.split(',');
        const obj = {};
        headers.forEach((h, i) => obj[h] = values[i]?.trim());
        return obj;
    });
};

const parseXML = (xmlText) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    return Array.from(xmlDoc.querySelectorAll('region')).map(reg => {
        const ca = parseFloat(reg.querySelector('ca_total')?.textContent || '0');
        const panier = parseFloat(reg.querySelector('panier_moyen')?.textContent || '1');
        const code = reg.getAttribute('code');
        
        // Coordonnées de votre code original
        const coords = { "IDF": [48.8566, 2.3522], "ARA": [45.7640, 4.8357], "PACA": [43.2965, 5.3698], "NAQ": [44.8378, -0.5792], "OCC": [43.6119, 3.8772], "HDF": [50.1203, 2.4477] };
        
        return {
            id: code,
            name: reg.getAttribute('nom'),
            sales: ca,
            transactions: Math.round(ca / panier),
            avgBasket: panier,
            growth: parseFloat(reg.querySelector('taux_fidelite')?.textContent || '0'),
            lat: coords[code]?.[0] || 46.22,
            lon: coords[code]?.[1] || 2.21
        };
    });
};

// ========== COMPOSANTS GENERIQUES ==========

const KPICard = ({ title, value, icon, status, meta }) => 
    e('div', { className: 'col-md-3 mb-4' },
        e('div', { className: `card h-100 kpi-card ${status}` },
            e('div', { className: 'card-body text-center' },
                e('div', { className: 'text-muted small text-uppercase' }, title),
                e('div', { className: 'kpi-value my-2' }, value),
                e('div', { className: 'small text-muted' }, meta),
                e('i', { className: `fas ${icon} fa-2x mt-2 opacity-25` })
            )
        )
    );

const ChartJS = ({ type, data, options }) => {
    const canvasRef = useRef(null);
    const chartInst = useRef(null);
    useEffect(() => {
        if (chartInst.current) chartInst.current.destroy();
        chartInst.current = new Chart(canvasRef.current, { type, data, options });
        return () => chartInst.current?.destroy();
    }, [data, options]);
    return e('canvas', { ref: canvasRef });
};

const PlotlyChart = ({ data, layout }) => {
    const divRef = useRef(null);
    useEffect(() => {
        Plotly.newPlot(divRef.current, data, layout, { responsive: true });
    }, [data, layout]);
    return e('div', { ref: divRef, style: { width: '100%', height: '400px' } });
};

// ========== APPLICATION PRINCIPALE ==========

const DashboardApp = () => {
    const [currentPage, setCurrentPage] = useState('overview');
    const [timeRange, setTimeRange] = useState('7d');
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({ products: [], sales: [], geo: [] });
    const [filters, setFilters] = useState({ category: 'all', sort: 'stock' });

    // 1. CHARGEMENT DES DONNÉES
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [csvRes, jsonRes, xmlRes] = await Promise.all([
                    fetch('Data/produits.csv').then(r => r.text()),
                    fetch('Data/ventes.json').then(r => r.json()),
                    fetch('Data/clients_regions.xml').then(r => r.text())
                ]);
                setData({
                    products: parseCSV(csvRes),
                    sales: jsonRes,
                    geo: parseXML(xmlRes)
                });
                setLoading(false);
            } catch (err) {
                console.error("Erreur de chargement", err);
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return e('div', { className: 'vh-100 d-flex justify-content-center align-items-center' }, e('div', { className: 'spinner-border text-primary' }));

    // 2. CALCULS KPI
    const totalStockValue = data.products.reduce((acc, p) => acc + (parseFloat(p.prix_unitaire || 0) * parseInt(p.stock_actuel || 0)), 0);
    const avgRating = (data.products.reduce((acc, p) => acc + parseFloat(p.note_moyenne || 0), 0) / data.products.length).toFixed(1);
    const lowStock = data.products.filter(p => parseInt(p.stock_actuel) < 10).length;

    // 3. LOGIQUE DES PAGES
    const renderOverview = () => e('div', null,
        e('div', { className: 'row' },
            e(KPICard, { title: 'Produits', value: data.products.length, icon: 'fa-box', status: 'success', meta: 'Total catalogue' }),
            e(KPICard, { title: 'Valeur Stock', value: `${totalStockValue.toLocaleString()}€`, icon: 'fa-euro-sign', status: 'success', meta: 'Valeur totale estimée' }),
            e(KPICard, { title: 'Note Moyenne', value: `${avgRating}/5`, icon: 'fa-star', status: 'warning', meta: 'Satisfaction client' }),
            e(KPICard, { title: 'Stock Faible', value: lowStock, icon: 'fa-exclamation-triangle', status: 'error', meta: 'Produits < 10 unités' })
        ),
        e('div', { className: 'row mt-4' },
            e('div', { className: 'col-md-8' }, 
                e('div', { className: 'chart-container' }, 
                    e('h5', null, 'Performance Globale'),
                    e(ChartJS, {
                        type: 'line',
                        data: {
                            labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
                            datasets: [{ label: 'CA (€)', data: [12000, 15000, 13500, 16000, 14500, 17000, 18500], borderColor: '#5bc0be', fill: true, backgroundColor: 'rgba(91,192,190,0.1)' }]
                        }
                    })
                )
            ),
            e('div', { className: 'col-md-4' },
                e('div', { className: 'chart-container' },
                    e('h5', null, 'Répartition Catégories'),
                    e(PlotlyChart, {
                        data: [{ values: [40, 30, 20, 10], labels: ['Informatique', 'Mode', 'Maison', 'Loisirs'], type: 'pie' }],
                        layout: { margin: { t: 0, b: 0, l: 0, r: 0 } }
                    })
                )
            )
        )
    );

    const renderSales = () => e('div', null,
        e('div', { className: 'chart-container' }, 
            e('h5', null, 'Top 10 Produits les plus vendus'),
            e(ChartJS, {
                type: 'bar',
                data: {
                    labels: data.products.slice(0, 10).map(p => p.nom_produit),
                    datasets: [{ label: 'Unités vendues', data: data.products.slice(0, 10).map(() => Math.floor(Math.random() * 500)), backgroundColor: '#3a506b' }]
                },
                options: { indexAxis: 'y' }
            })
        ),
        e('div', { className: 'card' },
            e('table', { className: 'table table-hover mb-0' },
                e('thead', null, e('tr', null, e('th', null, 'Date'), e('th', null, 'Produit'), e('th', null, 'CA'))),
                e('tbody', null, [1, 2, 3, 4, 5].map(i => e('tr', { key: i }, 
                    e('td', null, `1${i}/03/2026`), 
                    e('td', null, data.products[i]?.nom_produit), 
                    e('td', null, `${(Math.random()*100).toFixed(2)}€`)
                )))
            )
        )
    );

    const renderGeographic = () => e('div', null,
        e('div', { className: 'chart-container' },
            e('h5', null, 'Ventes par région'),
            e(PlotlyChart, {
                data: [{
                    type: 'scattermapbox',
                    lat: data.geo.map(g => g.lat),
                    lon: data.geo.map(g => g.lon),
                    text: data.geo.map(g => `${g.name}: ${g.sales}€`),
                    marker: { size: data.geo.map(g => g.sales / 50000), color: '#e74c3c' }
                }],
                layout: { mapbox: { style: "open-street-map", center: { lat: 46, lon: 2 }, zoom: 4 }, margin: { t: 0, b: 0, l: 0, r: 0 } }
            })
        ),
        e('div', { className: 'card mt-4' },
            e('table', { className: 'table align-middle' },
                e('thead', null, e('tr', null, e('th', null, 'Région'), e('th', null, 'CA'), e('th', null, 'Panier Moyen'), e('th', null, 'Fidélité'))),
                e('tbody', null, data.geo.map(g => e('tr', { key: g.id },
                    e('td', null, g.name), e('td', null, `${g.sales.toLocaleString()}€`), e('td', null, `${g.avgBasket}€`), e('td', { className: g.growth > 70 ? 'positive' : 'negative' }, `${g.growth}%`)
                )))
            )
        )
    );

    const renderProducts = () => {
        const filtered = data.products.filter(p => filters.category === 'all' || p.categorie === filters.category);
        return e('div', null,
            e('div', { className: 'd-flex gap-3 mb-4' },
                e('select', { className: 'form-select', onChange: (ev) => setFilters({...filters, category: ev.target.value}) }, 
                    e('option', { value: 'all' }, 'Toutes les catégories'),
                    [...new Set(data.products.map(p => p.categorie))].map(c => e('option', { key: c, value: c }, c))
                )
            ),
            e('div', { className: 'card' },
                e('table', { className: 'table small' },
                    e('thead', { className: 'table-light' }, e('tr', null, e('th', null, 'ID'), e('th', null, 'Nom'), e('th', null, 'Prix'), e('th', null, 'Stock'))),
                    e('tbody', null, filtered.map(p => e('tr', { key: p.produit_id },
                        e('td', null, p.produit_id), e('td', null, p.nom_produit), e('td', null, `${p.prix_unitaire}€`), e('td', null, e('span', { className: `badge ${parseInt(p.stock_actuel) < 10 ? 'bg-danger' : 'bg-success'}` }, p.stock_actuel))
                    )))
                )
            )
        );
    };

    // 4. RENDU GLOBAL (STRUCTURE)
    return e('div', { className: 'container-fluid px-0' },
        e('div', { className: 'row g-0' },
            // Sidebar
            e('div', { className: 'col-md-2 sidebar d-none d-md-block' },
                e('div', { className: 'px-4 mb-4 fw-bold text-uppercase' }, 'Dashboard E-commerce'),
                e('div', { className: `nav-link ${currentPage === 'overview' ? 'active' : ''}`, onClick: () => setCurrentPage('overview') }, e('i', { className: 'fas fa-home me-2' }), 'Vue d\'ensemble'),
                e('div', { className: `nav-link ${currentPage === 'sales' ? 'active' : ''}`, onClick: () => setCurrentPage('sales') }, e('i', { className: 'fas fa-shopping-cart me-2' }), 'Ventes'),
                e('div', { className: `nav-link ${currentPage === 'geographic' ? 'active' : ''}`, onClick: () => setCurrentPage('geographic') }, e('i', { className: 'fas fa-map me-2' }), 'Géographique'),
                e('div', { className: `nav-link ${currentPage === 'products' ? 'active' : ''}`, onClick: () => setCurrentPage('products') }, e('i', { className: 'fas fa-box me-2' }), 'Produits')
            ),
            // Main Content
            e('div', { className: 'col-md-10' },
                e('header', { className: 'bg-white p-3 border-bottom d-flex justify-content-between align-items-center' },
                    e('h4', { className: 'mb-0' }, 'Tableau de Bord'),
                    e('div', null, e('span', { className: 'status-dot success' }), 'Données synchronisées')
                ),
                e('div', { className: 'p-4' },
                    currentPage === 'overview' ? renderOverview() :
                    currentPage === 'sales' ? renderSales() :
                    currentPage === 'geographic' ? renderGeographic() :
                    renderProducts()
                )
            )
        )
    );
};

// Injection finale
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(e(DashboardApp));