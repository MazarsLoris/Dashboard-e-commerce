# Dashboard E-commerce

Un tableau de bord interactif et **100% Front-End** pour visualiser les performances d'une activité e-commerce.

---

## Fonctionnalités

*   **Vue d'ensemble :**
    *   **Objectifs :** Visualisation rapide des indicateurs clés.
    *   **KPIs :** Nb Produits, Valeur Stock, Note Moyenne, Stock Faible.
    *   Visualisation de la performance globale et répartition par catégorie.

*   **Analyse des Ventes :**
    *   Courbes d'évolution du chiffre d'affaires (Mensuel/Trimestriel).
    *   Tableau détaillé des meilleures ventes avec filtres dynamiques.

*   **Analyse Géographique :**
    *   Carte interactive (Plotly) des ventes par région.
    *   Classement des zones les plus performantes.

*   **Analyse par Produit :**
    *   Top 10 des produits (tri par Prix, Stock ou Avis).
    *   Alertes visuelles pour les stocks critiques (< 5 unités).

---

## Librairies Technique

*   **HTML5 / CSS3** (Variables CSS, Animations, Responsive).
*   **JavaScript (ES6+)** : `async/await`, `fetch API`, Parsing CSV/XML manuel.
*   **Bootstrap 5** : Structure de la grille et composants UI.
*   **Chart.js** : Graphiques en courbes et barres.
*   **Plotly.js** : Carte géographique et diagrammes circulaires.

---

## Installation

### 1. Cloner le dépôt GitLab
Ouvrez votre terminal (Git Bash, Terminal ou VS Code) et lancez les commandes suivantes pour récupérer les fichiers :

```bash
git clone git@docker.univ-avignon.fr:but3/2025-2026/e-commerce.git

# Entrez dans le dossier du projet
cd dashboard-ecommerce