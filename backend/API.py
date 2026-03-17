import os
import random
import time

from flask import Flask, abort, send_file
from flask_cors import CORS

app = Flask(__name__)
# Active CORS pour autoriser ton dashboard (sur le port 5500 ou autre) à appeler ce port 5000
CORS(app)

# Configuration : Chemin vers tes fichiers de données
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")


def simulate_chaos():
    """
    Cette fonction simule les problèmes techniques demandés dans le sujet.
    - 10% de chance d'erreur 503 (Service Unavailable)
    - 20% de chance de lenteur (latence réseau)
    """
    chance = random.random()

    if chance < 0.05:  # 5% de chance que le serveur plante
        print("SIMULATION: Erreur Serveur (503)")
        abort(503, description="Serveur momentanément indisponible (Simulation)")

    if chance < 0.03:  # 2% de chance  que ce soit lent
        delay = random.uniform(1, 3)
        print(f"SIMULATION: Latence réseau de {delay:.2f}s")
        time.sleep(delay)


@app.route("/")
def home():
    return "API E-commerce en ligne ! Utilisez /api/products, /api/sales, /api/geo"


@app.route("/api/products", methods=["GET"])
def get_products():
    simulate_chaos()  # On tente de casser le serveur
    try:
        # Renvoie le contenu du fichier CSV
        return send_file(os.path.join(DATA_DIR, "produits.csv"), mimetype="text/csv")
    except FileNotFoundError:
        abort(404, description="Fichier produits.csv introuvable")


@app.route("/api/sales", methods=["GET"])
def get_sales():
    simulate_chaos()
    try:
        # Renvoie le JSON direct
        return send_file(
            os.path.join(DATA_DIR, "ventes.json"), mimetype="application/json"
        )
    except FileNotFoundError:
        abort(404, description="Fichier ventes.json introuvable")


@app.route("/api/geo", methods=["GET"])
def get_geo():
    simulate_chaos()
    try:
        # Renvoie le XML
        return send_file(
            os.path.join(DATA_DIR, "clients_regions.xml"), mimetype="application/xml"
        )
    except FileNotFoundError:
        abort(404, description="Fichier clients_regions.xml introuvable")


if __name__ == "__main__":
    print("Serveur API lancé sur http://127.0.0.1:5000")
    print("Dossier de données visé :", DATA_DIR)
    app.run(debug=True, port=5000)
