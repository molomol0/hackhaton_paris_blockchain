from django.urls import path
from .consumer import LobbyConsumer

websocket_urlpatterns = [
    path('lobby', LobbyConsumer.as_asgi()),
]
