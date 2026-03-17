import React, { useState, useEffect, useRef, useMemo } from 'react';
import Chart from 'chart.js/auto';
import Plotly from 'plotly.js-dist-min';
import './App.css'; // Ton fichier CSS personnalisé

// ============================================================================
// 1. Gestion des erreurs
// ============================================================================
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Erreur critique capturée :", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="container mt-5">
                    <div className="alert alert-danger text-center">
                        <h4><i className="fas fa-bug me-2"></i>Oups ! Une erreur critique est survenue.</h4>
                        <p>Veuillez rafraîchir la page ou contacter le support.</p>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

// ============================================================================
// 2. UTILITAIRES DE PARSING (Logique métier)
// ============================================================================
function parseCSV(csv) {
    const lines = csv.split('\n').filter(l => l.trim() !== '');
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
        const values = line.split(',');
        let entry = {};
        headers.forEach((h, i) => entry[h] = values[i] ? values[i].trim() : '');
        return entry;
    });
}

function parseXML(xmlText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    return Array.from(xmlDoc.querySelectorAll('region')).map(reg => ({
        name: reg.getAttribute('nom'),
        code: reg.getAttribute('code'),
        sales: parseFloat(reg.querySelector('ca_total')?.textContent || 0),
        growth: parseFloat(reg.querySelector('taux_fidelite')?.textContent || 0),
        lat: reg.getAttribute('code') === 'IDF' ? 48.85 : reg.getAttribute('code') === 'ARA' ? 45.75 : 46.2,
        lon: reg.getAttribute('code') === 'IDF' ? 2.35 : reg.getAttribute('code') === 'ARA' ? 4.85 : 2.2
    }));
}

// ============================================================================
// 3. CUSTOM HOOK
// ============================================================================
const useDataFetcher = () => {
    const [data, setData] = useState({ products: [], sales: {}, geo: [] });
    const [status, setStatus] = useState('loading');
    const [errors, setErrors] = useState([]);

    useEffect(() => {
        const loadAll = async () => {
            setStatus('loading');
            
            // On utilise des chemins relatifs (/api/...) 
            // Le "proxy" dans package.json redirigera vers http://localhost:5005
            const results = await Promise.allSettled([
                fetch('/api/products').then(r => r.ok ? r.text() : Promise.reject('Produits inaccessibles')),
                fetch('/api/sales').then(r => r.ok ? r.json() : Promise.reject('Ventes inaccessibles')),
                fetch('/api/geo').then(r => r.ok ? r.text() : Promise.reject('Données Géo inaccessibles'))
            ]);

            const newData = { products: [], sales: {}, geo: [] };
            const newErrors = [];

            if (results[0].status === 'fulfilled') newData.products = parseCSV(results[0].value);
            else newErrors.push(results[0].reason);

            if (results[1].status === 'fulfilled') newData.sales = results[1].value;
            else newErrors.push(results[1].reason);

            if (results[2].status === 'fulfilled') newData.geo = parseXML(results[2].value);
            else newErrors.push(results[2].reason);

            setData(newData);
            setErrors(newErrors);

            if (newErrors.length === 0) setStatus('success');
            else if (newErrors.length === 3) setStatus('error');
            else setStatus('warning');
        };

        loadAll();
    }, []);

    return { data, status, errors };
};

// ============================================================================
// 4. COMPOSANTS D'INTERFACE
// ============================================================================

const Navbar = ({ currentPage, changePage, status, statusText, lastUpdate }) => {
    return (
        <nav className="navbar navbar-expand-lg fixed-top shadow-sm custom-navbar">
            <div className="container-fluid">
                <span className="navbar-brand fw-bold">
                    <i className="fas fa-chart-pie me-2"></i>Dashboard E-commerce
                </span>
                <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                    <span className="navbar-toggler-icon"></span>
                </button>
                <div className="collapse navbar-collapse" id="navbarNav">
                    <ul className="navbar-nav me-auto mb-2 mb-lg-0">
                        {[
                            { id: 'overview', icon: 'home', label: "Vue d'ensemble" },
                            { id: 'sales', icon: 'chart-line', label: 'Ventes' },
                            { id: 'geographic', icon: 'globe', label: 'Géographique' },
                            { id: 'products', icon: 'boxes', label: 'Produits' }
                        ].map(item => (
                            <li className="nav-item" key={item.id}>
                                <button 
                                    className={`nav-link btn btn-link ${currentPage === item.id ? 'active' : ''}`} 
                                    onClick={() => changePage(item.id)}
                                >
                                    <i className={`fas fa-${item.icon} me-1`}></i> {item.label}
                                </button>
                            </li>
                        ))}
                    </ul>
                    <div className="d-flex align-items-center gap-3 text-white-50">
                        <div className="server-status d-flex align-items-center px-3 py-1 rounded">
                            <span className={`status-dot ${status}`}></span>
                            <small className="ms-2 text-white small">{statusText}</small>
                        </div>
                        <div className="small border-start ps-3 border-white-50">
                            <span>{lastUpdate}</span>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
};

const Overview = ({ products, sales }) => {
    const chartRef = useRef(null);
    const chartInstance = useRef(null);

    const totalProducts = products.length;
    const totalStockValue = products.reduce((acc, p) => acc + (parseFloat(p.prix_unitaire) * parseInt(p.stock_actuel) || 0), 0);
    const avgRating = products.reduce((acc, p) => acc + parseFloat(p.note_moyenne || 0), 0) / (totalProducts || 1);
    const lowStockCount = products.filter(p => parseInt(p.stock_actuel) < 10).length;

    useEffect(() => {
        if (sales.ventes_mensuelles && chartRef.current) {
            if (chartInstance.current) chartInstance.current.destroy();
            const ctx = chartRef.current.getContext('2d');
            
            chartInstance.current = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: sales.ventes_mensuelles.map(m => m.mois),
                    datasets: [{
                        label: 'CA Total',
                        data: sales.ventes_mensuelles.map(m => m.top_produits.reduce((a, b) => a + parseFloat(b.ca), 0)),
                        borderColor: '#5bc0be',
                        backgroundColor: 'rgba(91, 192, 190, 0.2)',
                        fill: true, tension: 0.4
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
        return () => { if (chartInstance.current) chartInstance.current.destroy(); };
    }, [sales]);

    useEffect(() => {
        if (products.length > 0) {
            const cats = {};
            products.forEach(p => cats[p.categorie] = (cats[p.categorie] || 0) + 1);
            Plotly.newPlot('category-distribution-chart', [{
                type: 'pie', labels: Object.keys(cats), values: Object.values(cats), hole: 0.4
            }], { height: 300, margin: { t: 0, b: 0, l: 0, r: 0 } });
        }
    }, [products]);

    return (
        <div className="page-section active pt-5 mt-4">
            <h2 className="mb-4"><i className="fas fa-eye me-2"></i> Vue d'ensemble</h2>
            <div className="row g-4 mb-4">
                <div className="col-md-6 col-lg-3"><div className="kpi-card success"><div className="card-body"><div className="kpi-icon"><i className="fas fa-boxes"></i></div><div className="kpi-label">Nb Produits</div><div className="kpi-value">{totalProducts}</div></div></div></div>
                <div className="col-md-6 col-lg-3"><div className="kpi-card success"><div className="card-body"><div className="kpi-icon"><i className="fas fa-euro-sign"></i></div><div className="kpi-label">Valeur Stock</div><div className="kpi-value">{Math.round(totalStockValue).toLocaleString()}€</div></div></div></div>
                <div className="col-md-6 col-lg-3"><div className="kpi-card warning"><div className="card-body"><div className="kpi-icon"><i className="fas fa-star"></i></div><div className="kpi-label">Note Moyenne</div><div className="kpi-value">{avgRating.toFixed(2)}/5</div></div></div></div>
                <div className="col-md-6 col-lg-3"><div className="kpi-card error"><div className="card-body"><div className="kpi-icon"><i className="fas fa-exclamation-triangle"></i></div><div className="kpi-label">Stock Faible</div><div className="kpi-value">{lowStockCount}</div></div></div></div>
            </div>
            <div className="row g-4">
                <div className="col-lg-8"><div className="card shadow-sm h-100"><div className="card-header bg-white fw-bold border-0">Performance Globale</div><div className="card-body"><div style={{height:'300px'}}><canvas ref={chartRef}></canvas></div></div></div></div>
                <div className="col-lg-4"><div className="card shadow-sm h-100"><div className="card-header bg-white fw-bold border-0">Répartition par Catégorie</div><div className="card-body" id="category-distribution-chart"></div></div></div>
            </div>
        </div>
    );
};

const Sales = ({ sales, products }) => {
    const [period, setPeriod] = useState('monthly');
    const [category, setCategory] = useState('all');
    const chartRef = useRef(null);
    const chartInstance = useRef(null);

    const categories = useMemo(() => [...new Set(products.map(p => p.categorie))], [products]);

    const filteredData = useMemo(() => {
        if (!sales.ventes_mensuelles) return { labels: [], data: [], details: [] };
        
        const labels = [];
        const dataValues = [];
        const details = [];

        sales.ventes_mensuelles.forEach(m => {
            let total = 0;
            m.top_produits.forEach(tp => {
                const p = products.find(pr => pr.produit_id === tp.produit_id);
                if (category === 'all' || (p && p.categorie === category)) {
                    total += parseFloat(tp.ca);
                    details.push({
                        period: m.mois,
                        product: p ? p.nom_produit : tp.produit_id,
                        cat: p ? p.categorie : '-',
                        qty: tp.quantite,
                        ca: parseFloat(tp.ca)
                    });
                }
            });
            labels.push(m.mois);
            dataValues.push(total);
        });
        return { labels, data: dataValues, details };
    }, [sales, products, category, period]);

    useEffect(() => {
        if (chartRef.current && filteredData.labels.length > 0) {
            if (chartInstance.current) chartInstance.current.destroy();
            const ctx = chartRef.current.getContext('2d');
            chartInstance.current = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: filteredData.labels,
                    datasets: [{ label: 'CA Mensuel', data: filteredData.data, borderColor: '#3a506b', fill: false }]
                }, options: { responsive: true, maintainAspectRatio: false }
            });
        }
        return () => { if (chartInstance.current) chartInstance.current.destroy(); };
    }, [filteredData]);

    if (!sales.ventes_mensuelles) return <div className="alert alert-warning pt-5 mt-4">Données de ventes non disponibles.</div>;

    return (
        <div className="page-section active pt-5 mt-4">
            <h2 className="mb-4"><i className="fas fa-chart-line me-2"></i> Analyse des Ventes</h2>
            <div className="card shadow-sm mb-4">
                <div className="card-body d-flex gap-3 align-items-center flex-wrap">
                    <select className="form-select w-auto" value={period} onChange={(e) => setPeriod(e.target.value)}>
                        <option value="monthly">Mensuel</option>
                        <option value="quarterly">Trimestriel</option>
                    </select>
                    <select className="form-select w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
                        <option value="all">Toutes catégories</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            </div>
            <div className="card shadow-sm mb-4"><div className="card-header bg-white fw-bold">Évolution</div><div className="card-body"><div style={{ height: '300px' }}><canvas ref={chartRef}></canvas></div></div></div>
            <div className="card shadow-sm"><div className="card-header bg-white fw-bold">Détails</div><div className="table-responsive"><table className="table table-hover mb-0"><thead className="table-primary"><tr><th>Période</th><th>Produit</th><th>Cat</th><th>Qté</th><th>CA</th></tr></thead><tbody>{filteredData.details.map((d, i) => (<tr key={i}><td>{d.period}</td><td>{d.product}</td><td>{d.cat}</td><td>{d.qty}</td><td className="fw-bold">{d.ca.toLocaleString()}€</td></tr>))}</tbody></table></div></div>
        </div>
    );
};

const Geographic = ({ geoData }) => {
    const chartRef = useRef(null);
    const chartInstance = useRef(null);

    useEffect(() => {
        if (geoData.length > 0) {
            Plotly.newPlot('geo-map', [{
                type: 'scattermapbox',
                lat: geoData.map(g => g.lat), lon: geoData.map(g => g.lon),
                text: geoData.map(g => `${g.name}: ${g.sales}€`),
                marker: { size: 20, color: geoData.map(g => g.sales), colorscale: 'Blues' }
            }], {
                mapbox: { style: "open-street-map", center: { lat: 46.5, lon: 2.5 }, zoom: 4.5 },
                margin: { t: 0, b: 0, l: 0, r: 0 }, height: 500
            });

            if (chartRef.current) {
                if (chartInstance.current) chartInstance.current.destroy();
                const ctx = chartRef.current.getContext('2d');
                chartInstance.current = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: geoData.map(g => g.name),
                        datasets: [{ label: 'CA', data: geoData.map(g => g.sales), backgroundColor: '#3a506b' }]
                    }, options: { indexAxis: 'y', responsive: true }
                });
            }
        }
        return () => { if (chartInstance.current) chartInstance.current.destroy(); };
    }, [geoData]);

    if (geoData.length === 0) return <div className="alert alert-warning pt-5 mt-4">Données géographiques indisponibles.</div>;

    return (
        <div className="page-section active pt-5 mt-4">
            <h2 className="mb-4"><i className="fas fa-globe me-2"></i> Analyse Géographique</h2>
            <div className="row g-4">
                <div className="col-lg-8"><div className="card shadow-sm"><div className="card-body p-0"><div id="geo-map" style={{ height: '500px' }}></div></div></div></div>
                <div className="col-lg-4"><div className="card shadow-sm h-100"><div className="card-body"><canvas ref={chartRef} height="250"></canvas></div><div className="card-footer bg-white"><table className="table table-sm"><thead><tr><th>Région</th><th>CA</th><th>Perf.</th></tr></thead><tbody>{geoData.map((g, i) => (<tr key={i}><td>{g.name}</td><td>{g.sales}€</td><td className="text-success fw-bold">{g.growth}%</td></tr>))}</tbody></table></div></div></div>
            </div>
        </div>
    );
};

const Products = ({ products }) => {
    const [category, setCategory] = useState('all');
    const [sortBy, setSortBy] = useState('stock');
    const chartRef = useRef(null);
    const chartInstance = useRef(null);

    const categories = useMemo(() => [...new Set(products.map(p => p.categorie))], [products]);

    const filteredAndSorted = useMemo(() => {
        let res = products.filter(p => category === 'all' || p.categorie === category);
        res.sort((a, b) => {
            const valA = parseFloat(sortBy === 'stock' ? a.stock_actuel : sortBy === 'price' ? a.prix_unitaire : a.note_moyenne) || 0;
            const valB = parseFloat(sortBy === 'stock' ? b.stock_actuel : sortBy === 'price' ? b.prix_unitaire : b.note_moyenne) || 0;
            return valB - valA;
        });
        return res;
    }, [products, category, sortBy]);

    useEffect(() => {
        const top10 = filteredAndSorted.slice(0, 10);
        if (chartRef.current && top10.length > 0) {
            if (chartInstance.current) chartInstance.current.destroy();
            const ctx = chartRef.current.getContext('2d');
            chartInstance.current = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: top10.map(p => p.nom_produit.substring(0, 15) + '...'),
                    datasets: [{ label: 'Top Produits', data: top10.map(p => sortBy === 'stock' ? p.stock_actuel : p.prix_unitaire), backgroundColor: '#5bc0be' }]
                }, options: { responsive: true, maintainAspectRatio: false }
            });
        }
        return () => { if (chartInstance.current) chartInstance.current.destroy(); };
    }, [filteredAndSorted, sortBy]);

    return (
        <div className="page-section active pt-5 mt-4">
            <h2 className="mb-4"><i className="fas fa-boxes me-2"></i> Analyse par Produit</h2>
            <div className="card shadow-sm mb-4">
                <div className="card-body d-flex gap-3 align-items-center flex-wrap">
                    <select className="form-select w-auto" value={category} onChange={(e) => setCategory(e.target.value)}><option value="all">Toutes catégories</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
                    <select className="form-select w-auto" value={sortBy} onChange={(e) => setSortBy(e.target.value)}><option value="stock">Stock</option><option value="price">Prix</option><option value="rating">Note</option></select>
                </div>
            </div>
            <div className="card shadow-sm mb-4"><div className="card-body"><div className="chart-container" style={{ height: '300px' }}><canvas ref={chartRef}></canvas></div></div></div>
            <div className="card shadow-sm"><div className="card-body p-0"><div className="table-responsive"><table className="table table-striped mb-0"><thead className="table-primary"><tr><th>Nom</th><th>Cat</th><th>Prix</th><th>Stock</th><th>Note</th></tr></thead><tbody>{filteredAndSorted.map(p => (<tr key={p.produit_id}><td>{p.nom_produit}</td><td>{p.categorie}</td><td>{p.prix_unitaire}€</td><td className={parseInt(p.stock_actuel) < 5 ? 'text-danger' : 'text-success'}>{p.stock_actuel}</td><td>{p.note_moyenne}/5</td></tr>))}</tbody></table></div></div></div>
        </div>
    );
};

// ============================================================================
// 5. COMPOSANT PRINCIPAL (App)
// ============================================================================
const App = () => {
    const [currentPage, setCurrentPage] = useState('overview');
    const [lastUpdate, setLastUpdate] = useState('--:--');
    
    // Appel du Custom Hook
    const { data, status, errors } = useDataFetcher();

    useEffect(() => {
        setLastUpdate(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    }, [status]);

    const statusText = status === 'loading' ? 'Chargement...' : status === 'error' ? 'Erreur critique' : status === 'warning' ? 'Mode dégradé' : 'Données à jour';
    const statusColor = status === 'warning' ? 'warning' : status === 'error' ? 'error' : status === 'loading' ? 'warning' : 'success';

    return (
        <ErrorBoundary>
            <Navbar currentPage={currentPage} changePage={setCurrentPage} status={statusColor} statusText={statusText} lastUpdate={lastUpdate} />
            <main className="container-fluid main-content px-4">
                {errors.length > 0 && status !== 'loading' && (
                    <div className="alert alert-warning mt-5 fade show">
                        <strong>Attention :</strong> Certaines données n'ont pas pu être chargées ({errors.join(', ')}).
                    </div>
                )}
                {currentPage === 'overview' && <Overview products={data.products} sales={data.sales} />}
                {currentPage === 'sales' && <Sales sales={data.sales} products={data.products} />}
                {currentPage === 'geographic' && <Geographic geoData={data.geo} />}
                {currentPage === 'products' && <Products products={data.products} />}
            </main>
        </ErrorBoundary>
    );
};

// EXPORT DU COMPOSANT (Pour qu'il soit utilisé par index.js)
export default App;