// Variables globales pour stocker les données :
let productsData = []; // Variable pour stocker les données des produits.
let salesData = {}; // Pareil avec les ventes (Initialisé objet vide pour éviter bug si chargement fail).
let geoData = [];
let appState = { currentPage: 'overview' }; // Permet de gérer l'état global du dashboard.
let charts = {}; // Variable pour stocker les visualisations avec Chart.js

// Fonction pour mettre à jour l'état du dashboard :
document.addEventListener('DOMContentLoaded', function() {
    updateLastUpdateTime(); 
    setInterval(updateLastUpdateTime, 60000);
    loadAllData();
});

// Fonction de chargement des données avec gestion d'erreurs (Mode dégradé) :
async function loadAllData() {
    updateStatus('loading', 'Chargement...');
    
    // On utilise Promise.allSettled pour que si un fichier plante, les autres se chargent quand même.
    const results = await Promise.allSettled([
    fetch('http://127.0.0.1:5000/api/products').then(r => r.ok ? r.text() : Promise.reject('Produits introuvables')),
    
    fetch('http://127.0.0.1:5000/api/sales').then(r => r.ok ? r.json() : Promise.reject('Ventes introuvables')),
    
    fetch('http://127.0.0.1:5000/api/geo').then(r => r.ok ? r.text() : Promise.reject('Données géographiques introuvables'))
]);

    const errors = [];

    // 1. Traitement Produits
    if (results[0].status === 'fulfilled') {
        productsData = parseCSV(results[0].value);
    } else {
        errors.push("Fichier produits");
        console.error("Erreur CSV", results[0].reason);
    }

    // 2. Traitement Ventes
    if (results[1].status === 'fulfilled') {
        salesData = results[1].value;
    } else {
        errors.push("Fichier ventes");
        console.error("Erreur JSON", results[1].reason);
    }

    // 3. Traitement Géo
    if (results[2].status === 'fulfilled') {
        geoData = parseXML(results[2].value);
    } else {
        errors.push("Fichier régions");
        console.error("Erreur XML", results[2].reason);
    }

    // Gestion de l'affichage des erreurs (Mode dégradé)
    handleErrors(errors);

    // Lancement de l'interface
    updateCategoryFilters();
    changePage('overview');
}

// Fonction pour gérer l'affichage visuel des erreurs :
function handleErrors(errors) {
    const container = document.getElementById('alert-container');
    container.innerHTML = '';
    
    if (errors.length === 0) {
        updateStatus('success', 'Données chargées');
    } else if (errors.length === 3) {
        updateStatus('error', 'Erreur critique');
        container.innerHTML = '<div class="alert alert-danger m-3">Impossible de charger les données. Vérifiez votre connexion.</div>';
    } else {
        updateStatus('warning', 'Mode dégradé');
        container.innerHTML = `<div class="alert alert-warning m-3">Attention : Certaines données sont manquantes (${errors.join(', ')}).</div>`;
    }
}

// Fonction pour extraire et convertir les données csv en tableaux :
function parseCSV(csv) {
    const lines = csv.split('\n').filter(l => l.trim() !== ''); // On sépare en lignes et on retire lignes vides.
    const headers = lines[0].split(',').map(h => h.trim()); // On récupère le noms des colonnes.
    return lines.slice(1).map(line => {
        const values = line.split(','); // On sépare les colonnes.
        let entry = {};
        headers.forEach((h, i) => entry[h] = values[i] ? values[i].trim() : '');
        return entry;
    });
}

// Fonction extraire les données xml :
function parseXML(xmlText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    return Array.from(xmlDoc.querySelectorAll('region')).map(reg => ({
        name: reg.getAttribute('nom'), // Permet de récupèrer le noms des régions.
        code: reg.getAttribute('code'), // Récupère le code de la région.
        sales: parseFloat(reg.querySelector('ca_total')?.textContent || 0),
        growth: parseFloat(reg.querySelector('taux_fidelite')?.textContent || 0),
        lat: reg.getAttribute('code')==='IDF'?48.85: reg.getAttribute('code')==='ARA'?45.75: 46.2,
        lon: reg.getAttribute('code')==='IDF'?2.35: reg.getAttribute('code')==='ARA'?4.85: 2.2
    }));
}

// Système de navigation :
window.changePage = function(pageId, el) {
    if(el) {
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        el.classList.add('active');
    } else {
        document.querySelectorAll('.nav-link').forEach(l => {
            if(l.onclick.toString().includes(pageId)) l.classList.add('active');
        });
    }
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.getElementById(pageId + '-section').classList.add('active');
    
    if(pageId === 'overview') renderOverview(); // Permet d'afficher ce que l'on veut dans l'onglet choisis.
    if(pageId === 'sales') updateSalesPage();
    if(pageId === 'geographic') renderGeographic();
    if(pageId === 'products') updateProductsPage();

    setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
    
    // Fermeture auto menu mobile
    const navbarCollapse = document.getElementById('navbarNav');
    if(navbarCollapse && navbarCollapse.classList.contains('show')) new bootstrap.Collapse(navbarCollapse).hide();
};

// Fonctions pour la Vue d'ensemble :
function renderOverview() {
    const totalProducts = productsData.length;
    const totalStockValue = productsData.reduce((acc, p) => acc + (parseFloat(p.prix_unitaire)*parseInt(p.stock_actuel)||0), 0);
    const avgRating = productsData.length ? productsData.reduce((acc, p) => acc + parseFloat(p.note_moyenne||0), 0) / (totalProducts||1) : 0;
    const lowStockCount = productsData.filter(p => parseInt(p.stock_actuel) < 10).length;
    
    document.getElementById('kpi-container').innerHTML = `
        <div class="col-md-6 col-lg-3"><div class="kpi-card success"><div class="card-body"><div class="kpi-icon"><i class="fas fa-boxes"></i></div><div class="kpi-label">Nb Produits</div><div class="kpi-value">${totalProducts}</div><div class="kpi-meta">Total en stock</div></div></div></div>
        <div class="col-md-6 col-lg-3"><div class="kpi-card success"><div class="card-body"><div class="kpi-icon"><i class="fas fa-euro-sign"></i></div><div class="kpi-label">Valeur Stock</div><div class="kpi-value">${Math.round(totalStockValue).toLocaleString()}€</div><div class="kpi-meta">Valeur totale</div></div></div></div>
        <div class="col-md-6 col-lg-3"><div class="kpi-card warning"><div class="card-body"><div class="kpi-icon"><i class="fas fa-star"></i></div><div class="kpi-label">Note Moyenne</div><div class="kpi-value">${avgRating.toFixed(2)}/5</div><div class="kpi-meta">Moyenne Avis</div></div></div></div>
        <div class="col-md-6 col-lg-3"><div class="kpi-card error"><div class="card-body"><div class="kpi-icon"><i class="fas fa-exclamation-triangle"></i></div><div class="kpi-label">Stock Faible</div><div class="kpi-value">${lowStockCount}</div><div class="kpi-meta">Produits < 10</div></div></div></div>
    `;

    // Sécurisation si les ventes n'ont pas chargé
    if(salesData.ventes_mensuelles) {
        document.getElementById('global-error').classList.add('d-none');
        const ctx = document.getElementById('global-performance-chart').getContext('2d');
        if(charts.global) charts.global.destroy();
        charts.global = new Chart(ctx, {
            type: 'line',
            data: {
                labels: salesData.ventes_mensuelles.map(m => m.mois),
                datasets: [{
                    label: 'CA Total',
                    data: salesData.ventes_mensuelles.map(m => m.top_produits.reduce((a,b)=>a+parseFloat(b.ca),0)),
                    borderColor: '#5bc0be',
                    backgroundColor: 'rgba(91, 192, 190, 0.2)',
                    fill: true, tension: 0.4
                }]
            }, options: { responsive: true, maintainAspectRatio: false }
        });
    } else {
        document.getElementById('global-error').classList.remove('d-none');
    }

    if(productsData.length > 0) {
        const cats = {};
        productsData.forEach(p => cats[p.categorie] = (cats[p.categorie]||0)+1);
        Plotly.newPlot('category-distribution-chart', [{
            type: 'pie', labels: Object.keys(cats), values: Object.values(cats), hole: 0.4
        }], { height: 300, margin: {t:0,b:0,l:0,r:0} });
    }
}

// Fonction pour la création des filtres :
function updateCategoryFilters() {
    if(productsData.length === 0) return;
    const cats = [...new Set(productsData.map(p => p.categorie))];
    const selects = ['sales-category', 'product-category'];
    selects.forEach(id => {
        const el = document.getElementById(id);
        if(!el) return;
        const currentVal = el.value;
        el.innerHTML = '<option value="all">Toutes catégories</option>';
        cats.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c; opt.textContent = c;
            el.appendChild(opt);
        });
        el.value = currentVal;
    });
}

// Fonction pour tous les visuels de l'onglet "Ventes" :
window.updateSalesPage = function() {
    if(!salesData.ventes_mensuelles) {
        document.getElementById('sales-section').innerHTML = "<div class='alert alert-warning m-4'>Données de ventes indisponibles.</div>";
        return;
    }
    
    const catFilter = document.getElementById('sales-category').value;
    const labels = [];
    const dataValues = [];
    const tbody = document.getElementById('sales-details-table').querySelector('tbody');
    tbody.innerHTML = '';

    salesData.ventes_mensuelles.forEach(m => {
        let total = 0;
        m.top_produits.forEach(tp => {
            const p = productsData.find(pr => pr.produit_id === tp.produit_id);
            if(catFilter === 'all' || (p && p.categorie === catFilter)) {
                total += parseFloat(tp.ca);
                tbody.innerHTML += `<tr><td>${m.mois}</td><td>${p?p.nom_produit:tp.produit_id}</td><td>${p?p.categorie:'-'}</td><td>${tp.quantite}</td><td class="fw-bold">${parseFloat(tp.ca).toLocaleString()}€</td></tr>`;
            }
        });
        labels.push(m.mois);
        dataValues.push(total);
    });

    const ctx = document.getElementById('sales-trend-chart').getContext('2d');
    if(charts.trend) charts.trend.destroy();
    charts.trend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{ label: 'CA Mensuel', data: dataValues, borderColor: '#3a506b', fill: false }]
        }, options: { responsive: true, maintainAspectRatio: false }
    });
}

// Fonctions pour la section "Géographie" :
function renderGeographic() {
    if(geoData.length === 0) {
        document.getElementById('geographic-section').innerHTML = "<div class='alert alert-warning m-4'>Données géographiques indisponibles.</div>";
        return;
    }

    const mapData = [{
        type: 'scattermapbox',
        lat: geoData.map(g => g.lat), lon: geoData.map(g => g.lon),
        text: geoData.map(g => `${g.name}: ${g.sales}€`),
        marker: { size: 20, color: geoData.map(g => g.sales), colorscale: 'Blues' }
    }];
    Plotly.newPlot('geo-map', mapData, {
        mapbox: { style: "open-street-map", center: {lat: 46.5, lon: 2.5}, zoom: 4.5 },
        margin: {t:0,b:0,l:0,r:0}, height: 500
    });

    const ctx = document.getElementById('top-regions-chart').getContext('2d');
    if(charts.geo) charts.geo.destroy();
    charts.geo = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: geoData.map(g => g.name),
            datasets: [{ label: 'CA', data: geoData.map(g => g.sales), backgroundColor: '#3a506b' }]
        }, options: { indexAxis: 'y', responsive: true }
    });

    const tbody = document.getElementById('geo-performance-table').querySelector('tbody');
    tbody.innerHTML = '';
    geoData.forEach(g => tbody.innerHTML += `<tr><td>${g.name}</td><td>${g.sales}€</td><td class="text-success fw-bold">${g.growth}%</td></tr>`);
}

// Fonctions pour l'onglet "Produits" :
window.updateProductsPage = function() {
    if(productsData.length === 0) {
        document.getElementById('products-section').innerHTML = "<div class='alert alert-warning m-4'>Données produits indisponibles.</div>";
        return;
    }

    const catFilter = document.getElementById('product-category').value;
    const sortBy = document.getElementById('product-sort').value;
    let filtered = productsData.filter(p => catFilter === 'all' || p.categorie === catFilter);
    
    filtered.sort((a, b) => {
        const valA = parseFloat(sortBy === 'stock' ? a.stock_actuel : sortBy === 'price' ? a.prix_unitaire : sortBy === 'rating' ? a.note_moyenne : a.nb_avis) || 0;
        const valB = parseFloat(sortBy === 'stock' ? b.stock_actuel : sortBy === 'price' ? b.prix_unitaire : sortBy === 'rating' ? b.note_moyenne : b.nb_avis) || 0;
        return valB - valA;
    });

    const top10 = filtered.slice(0, 10);
    const ctx = document.getElementById('top-products-chart-products').getContext('2d');
    if(charts.products) charts.products.destroy();
    charts.products = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: top10.map(p => p.nom_produit.substring(0,15)+'...'),
            datasets: [{ label: 'Top Produits', data: top10.map(p => sortBy==='stock'?p.stock_actuel:p.prix_unitaire), backgroundColor: '#5bc0be' }]
        }, options: { responsive: true, maintainAspectRatio: false }
    });

    const tbody = document.getElementById('products-details-table').querySelector('tbody');
    tbody.innerHTML = '';
    filtered.forEach(p => {
        tbody.innerHTML += `<tr><td>${p.produit_id}</td><td class="fw-bold">${p.nom_produit}</td><td>${p.categorie}</td><td>${p.prix_unitaire}€</td><td class="${p.stock_actuel<5?'text-danger':'text-success'}">${p.stock_actuel}</td><td>${p.note_moyenne}/5</td></tr>`;
    });
}

// Fonction pour le statut de la page :
function updateStatus(type, msg) {
    const el = document.getElementById('data-status-dot');
    if(el) {
        el.className = `status-dot ${type}`;
        document.getElementById('data-status-text').innerText = msg;
    }
}
function updateLastUpdateTime() {
    const el = document.getElementById('last-update');
    if(el) el.innerText = new Date().toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
}