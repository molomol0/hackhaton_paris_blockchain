#!/bin/sh
set -e  # Arrêter le script en cas d'erreur


# Exécuter les migrations Django
echo "🔄 Exécution des migrations..."
python manage.py makemigrations authService
python manage.py migrate

# Créer un superutilisateur si aucun n'existe


# Lancer le serveur Django
echo "🚀 Démarrage du serveur Django..."
exec daphne -b 0.0.0.0 -p 8000 lastbidder.asgi:application